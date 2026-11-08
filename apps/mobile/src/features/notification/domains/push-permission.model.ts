import { PUSH_PERMISSION_STATUS } from '@aido/api/vocabulary';
import { DAY_MS } from '@src/shared/constants/time-units';
import { diffMs, type Instant, instantSchema } from '@src/shared/date/instant';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { PUSH_PERMISSION_STEP, PUSH_PROMPT_SNOOZE_DAYS } from '../constants/notification.constants';

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

type PushPermissionStep = (typeof PUSH_PERMISSION_STEP)[keyof typeof PUSH_PERMISSION_STEP];

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
  isPromptSnoozed,
  getNextStep,
} as const;
