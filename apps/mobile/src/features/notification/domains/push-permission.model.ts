import { PUSH_PERMISSION_STATUS } from '@aido/api/vocabulary';
import { DAY_MS } from '@src/shared/constants/time-units';
import {
  diffMs,
  fromEpochMs,
  hasInstantPassed,
  type Instant,
  instantSchema,
  toEpochMs,
} from '@src/shared/date/instant';
import { match } from 'ts-pattern';
import { z } from 'zod';

import {
  PUSH_ASK_MOMENT,
  PUSH_ONBOARDING_WINDOW_DAYS,
  PUSH_PERMISSION_STEP,
  PUSH_PROMPT_SNOOZE_DAYS,
} from '../constants/notification.constants';

const pushPermissionSchema = z.object({
  status: z.enum(PUSH_PERMISSION_STATUS),
  canAskAgain: z.boolean(),
});
export type PushPermission = z.infer<typeof pushPermissionSchema>;

const pushDeviceSchema = z.object({
  permission: pushPermissionSchema,
  hasActiveToken: z.boolean(),
  reportedAt: instantSchema,
});
export type PushDevice = z.infer<typeof pushDeviceSchema>;

/** 계정마다 기기에 남긴 답. 알림 화면과 피드 꺼짐 안내를 닫은 시각이다 */
const pushPermissionPromptSchema = z.object({
  deferredAt: instantSchema.nullable(),
  noticeDismissedAt: instantSchema.nullable(),
});
type PushPermissionPrompt = z.infer<typeof pushPermissionPromptSchema>;

export type PushPermissionStep = (typeof PUSH_PERMISSION_STEP)[keyof typeof PUSH_PERMISSION_STEP];
type PushAskMoment = (typeof PUSH_ASK_MOMENT)[keyof typeof PUSH_ASK_MOMENT];

type PushAskContext =
  | {
      surface: 'onboarding';
      signedUpAt: Instant;
      prompt: Pick<PushPermissionPrompt, 'deferredAt'>;
      now: Instant;
    }
  | { surface: 'todo-time' }
  | {
      surface: 'feed';
      hasUpcomingTimedTodo: boolean;
      prompt: Pick<PushPermissionPrompt, 'noticeDismissedAt'>;
      now: Instant;
    };

/** iOS 임시 허용(provisional·ephemeral)도 알림이 조용히 도착하므로 허용으로 본다 */
function isPushDeliverable(permission: PushPermission): boolean {
  return (
    permission.status === PUSH_PERMISSION_STATUS.GRANTED ||
    permission.status === PUSH_PERMISSION_STATUS.PROVISIONAL
  );
}

function isNotDetermined(permission: PushPermission): boolean {
  return permission.status === PUSH_PERMISSION_STATUS.NOT_DETERMINED;
}

function canRequestSystemDialog(permission: PushPermission): boolean {
  return !isPushDeliverable(permission) && permission.canAskAgain;
}

function isSettingsRequired(permission: PushPermission): boolean {
  return !isPushDeliverable(permission) && !permission.canAskAgain;
}

function isPromptSnoozed(dismissedAt: Instant | null, now: Instant): boolean {
  if (dismissedAt == null) {
    return false;
  }
  return diffMs(now, dismissedAt) < PUSH_PROMPT_SNOOZE_DAYS * DAY_MS;
}

/** 가입 직후 알림 화면을 보여 줄 수 있는 마지막 순간. 이 시각부터는 할 일 시간을 정할 때 묻는다 */
function getOnboardingWindowEndsAt(signedUpAt: Instant): Instant {
  return fromEpochMs(toEpochMs(signedUpAt) + PUSH_ONBOARDING_WINDOW_DAYS * DAY_MS);
}

function isRecentSignup(signedUpAt: Instant, now: Instant): boolean {
  return (
    0 <= diffMs(now, signedUpAt) && !hasInstantPassed(getOnboardingWindowEndsAt(signedUpAt), now)
  );
}

function isDenied(permission: PushPermission): boolean {
  return !isPushDeliverable(permission) && !isNotDetermined(permission);
}

/**
 * 알림을 묻는 곳은 셋이다. 가입 직후 알림 화면은 한 번, 할 일 시간을 정하면 그 자리에서 시스템 창,
 * 거절한 뒤에는 알림이 갈 할 일이 있을 때만 꺼짐 안내다. 허용했으면 묻지 않는다
 */
function getAskMoment(permission: PushPermission, context: PushAskContext): PushAskMoment | null {
  if (isPushDeliverable(permission)) {
    return null;
  }

  return match(context)
    .with({ surface: 'onboarding' }, ({ signedUpAt, prompt, now }) =>
      isNotDetermined(permission) && prompt.deferredAt == null && isRecentSignup(signedUpAt, now)
        ? PUSH_ASK_MOMENT.ONBOARDING_SCREEN
        : null,
    )
    .with({ surface: 'todo-time' }, () =>
      isNotDetermined(permission) ? PUSH_ASK_MOMENT.SYSTEM_DIALOG : PUSH_ASK_MOMENT.DENIED_NOTICE,
    )
    .with({ surface: 'feed' }, ({ hasUpcomingTimedTodo, prompt, now }) =>
      isDenied(permission) &&
      hasUpcomingTimedTodo &&
      !isPromptSnoozed(prompt.noticeDismissedAt, now)
        ? PUSH_ASK_MOMENT.DENIED_NOTICE
        : null,
    )
    .exhaustive();
}

/** OS가 허용했고 앱 푸시 설정도 켜져 있어야 할 일 알림이 닿는다 */
function canReceivePush(permission: PushPermission, { pushEnabled }: { pushEnabled: boolean }) {
  return isPushDeliverable(permission) && pushEnabled;
}

/** 알림을 받으려면 사용자가 다음에 무엇을 해야 하는지 정한다. 문구·화면은 컴포넌트가 정한다 */
function getNextStep(
  permission: PushPermission,
  { pushEnabled }: { pushEnabled: boolean },
): PushPermissionStep {
  return match(permission)
    .when(isPushDeliverable, () =>
      pushEnabled ? PUSH_PERMISSION_STEP.NONE : PUSH_PERMISSION_STEP.ENABLE_IN_APP,
    )
    .when(isSettingsRequired, () => PUSH_PERMISSION_STEP.OPEN_SETTINGS)
    .when(isNotDetermined, () => PUSH_PERMISSION_STEP.ASK)
    .otherwise(() => PUSH_PERMISSION_STEP.REQUEST_SYSTEM);
}

export const PushPermissionPolicy = {
  isPushDeliverable,
  isNotDetermined,
  canRequestSystemDialog,
  canReceivePush,
  getAskMoment,
  getOnboardingWindowEndsAt,
  getNextStep,
} as const;
