import { isDeliverablePushPermission, PUSH_PERMISSION_STATUS } from '@aido/api/vocabulary';
import { DAY_MS } from '@src/shared/constants/time-units';
import {
  diffMs,
  fromEpochMs,
  hasInstantPassed,
  type Instant,
  toEpochMs,
} from '@src/shared/date/instant';
import { match } from 'ts-pattern';
import { z } from 'zod';

import type { PushPermissionPrompt } from './push-permission-prompt.model';

/** 홈 알림 안내를 닫으면 이 날수 동안 다시 보이지 않는다 */
const PUSH_PROMPT_SNOOZE_DAYS = 14;
/** 가입 뒤 이 날수 안에만 알림 화면을 보여 준다. 그 뒤에는 할 일 시간을 정할 때 묻는다 */
const PUSH_ONBOARDING_WINDOW_DAYS = 1;

export const pushPermissionSchema = z.object({
  status: z.enum(PUSH_PERMISSION_STATUS),
  canAskAgain: z.boolean(),
});
export type PushPermission = z.infer<typeof pushPermissionSchema>;

/** 알림을 받으려면 사용자가 다음에 할 일. 코드에서 부르는 이름은 constants의 PUSH_PERMISSION_STEP */
export type PushPermissionStep =
  | 'ASK'
  | 'REQUEST_SYSTEM'
  | 'OPEN_SETTINGS'
  | 'ENABLE_IN_APP'
  | 'NONE';
type PushDeviceStep = Exclude<PushPermissionStep, 'ENABLE_IN_APP'>;
/** 알림 설정 줄에 보일 지금 상태. 기기에서 꺼짐은 앱에서 켰는데 기기가 거절해 닿지 않는 때다 */
export type PushSummary = 'on' | 'off' | 'deviceOff';
/** 알림을 어떻게 물을지. 코드에서 부르는 이름은 constants의 PUSH_ASK_MOMENT */
export type PushAskMoment = 'ONBOARDING_SCREEN' | 'SYSTEM_DIALOG' | 'DENIED_NOTICE';

type PushAskContext =
  | {
      surface: 'onboarding';
      signedUpAt: Instant;
      prompt: Pick<PushPermissionPrompt, 'deferredAt'>;
      now: Instant;
    }
  | { surface: 'todo_time' }
  | {
      surface: 'feed';
      hasUpcomingTimedTodo: boolean;
      prompt: Pick<PushPermissionPrompt, 'noticeDismissedAt'>;
      now: Instant;
    };

function isSettingsRequired(permission: PushPermission): boolean {
  return !PushPermissionPolicy.isPushDeliverable(permission) && !permission.canAskAgain;
}

function isPromptSnoozed(dismissedAt: Instant | null, now: Instant): boolean {
  if (dismissedAt == null) {
    return false;
  }
  return diffMs(now, dismissedAt) < PUSH_PROMPT_SNOOZE_DAYS * DAY_MS;
}

/** 가입 직후 알림 화면을 보여 줄 수 있는 마지막 순간. 이 시각부터는 할 일 시간을 정할 때 묻는다 */
export function getOnboardingWindowEndsAt(signedUpAt: Instant): Instant {
  return fromEpochMs(toEpochMs(signedUpAt) + PUSH_ONBOARDING_WINDOW_DAYS * DAY_MS);
}

function isRecentSignup(signedUpAt: Instant, now: Instant): boolean {
  return (
    0 <= diffMs(now, signedUpAt) && !hasInstantPassed(getOnboardingWindowEndsAt(signedUpAt), now)
  );
}

function isDenied(permission: PushPermission): boolean {
  return (
    !PushPermissionPolicy.isPushDeliverable(permission) &&
    !PushPermissionPolicy.isUndecided(permission)
  );
}

export const PushPermissionPolicy = {
  isPushDeliverable(permission: PushPermission): boolean {
    return isDeliverablePushPermission(permission.status);
  },

  isUndecided(permission: PushPermission): boolean {
    return permission.status === PUSH_PERMISSION_STATUS.NOT_DETERMINED;
  },

  canRequestSystemDialog(permission: PushPermission): boolean {
    return !this.isPushDeliverable(permission) && permission.canAskAgain;
  },

  /**
   * 알림을 묻는 곳은 셋이다. 가입 직후 알림 화면은 한 번, 할 일 시간을 정하면 그 자리에서 시스템 창,
   * 거절한 뒤에는 알림이 갈 할 일이 있을 때만 꺼짐 안내다. 허용했으면 묻지 않는다
   */
  findAskMoment(permission: PushPermission, context: PushAskContext): PushAskMoment | null {
    if (this.isPushDeliverable(permission)) {
      return null;
    }

    return match(context)
      .with({ surface: 'onboarding' }, ({ signedUpAt, prompt, now }) =>
        this.isUndecided(permission) && prompt.deferredAt == null && isRecentSignup(signedUpAt, now)
          ? 'ONBOARDING_SCREEN'
          : null,
      )
      .with({ surface: 'todo_time' }, () =>
        this.isUndecided(permission) ? 'SYSTEM_DIALOG' : 'DENIED_NOTICE',
      )
      .with({ surface: 'feed' }, ({ hasUpcomingTimedTodo, prompt, now }) =>
        isDenied(permission) &&
        hasUpcomingTimedTodo &&
        !isPromptSnoozed(prompt.noticeDismissedAt, now)
          ? 'DENIED_NOTICE'
          : null,
      )
      .exhaustive();
  },

  /** OS가 허용했고 앱 푸시 설정도 켜져 있어야 할 일 알림이 닿는다 */
  canReceivePush(permission: PushPermission, { pushEnabled }: { pushEnabled: boolean }): boolean {
    return this.isPushDeliverable(permission) && pushEnabled;
  },

  /** 기기 권한만 본 다음 단계. 앱 안 푸시 설정은 보지 않는다 */
  getDeviceStep(permission: PushPermission): PushDeviceStep {
    return match(permission)
      .returnType<PushDeviceStep>()
      .when(
        (permission) => this.isPushDeliverable(permission),
        () => 'NONE',
      )
      .when(isSettingsRequired, () => 'OPEN_SETTINGS')
      .when(
        (permission) => this.isUndecided(permission),
        () => 'ASK',
      )
      .otherwise(() => 'REQUEST_SYSTEM');
  },

  /**
   * 알림 설정 값. 앱에서 켰는데 기기에서 거절해 닿지 않으면 그 이유를 따로 보인다.
   * 아직 묻지 않은 기기는 거절한 것이 아니라 꺼짐으로 둔다
   */
  getSummary(permission: PushPermission, { pushEnabled }: { pushEnabled: boolean }): PushSummary {
    if (this.isPushDeliverable(permission)) {
      return pushEnabled ? 'on' : 'off';
    }
    return pushEnabled && !this.isUndecided(permission) ? 'deviceOff' : 'off';
  },

  /** 알림을 받으려면 사용자가 다음에 무엇을 해야 하는지 정한다. 문구·화면은 컴포넌트가 정한다 */
  getNextStep(
    permission: PushPermission,
    { pushEnabled }: { pushEnabled: boolean },
  ): PushPermissionStep {
    const deviceStep = this.getDeviceStep(permission);
    if (deviceStep === 'NONE' && !pushEnabled) {
      return 'ENABLE_IN_APP';
    }
    return deviceStep;
  },
};
