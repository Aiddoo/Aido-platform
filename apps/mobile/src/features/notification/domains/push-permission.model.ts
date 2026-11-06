import { PUSH_PERMISSION_STATUS } from '@aido/api/vocabulary';
import { DAY_MS } from '@src/shared/constants/time.constants';
import { match } from 'ts-pattern';
import { z } from 'zod';

const pushPermissionSchema = z.object({
  status: z.enum(PUSH_PERMISSION_STATUS),
  canAskAgain: z.boolean(),
});

export type PushPermission = z.infer<typeof pushPermissionSchema>;

const pushDeviceSchema = z.object({
  permission: pushPermissionSchema,
  hasActiveToken: z.boolean(),
  reportedAt: z.date(),
});

/** 서버가 저장한 이 기기의 상태 */
export type PushDevice = z.infer<typeof pushDeviceSchema>;

export const PUSH_PERMISSION_STEP = {
  ASK: 'ASK',
  REQUEST_SYSTEM: 'REQUEST_SYSTEM',
  OPEN_SETTINGS: 'OPEN_SETTINGS',
  ENABLE_IN_APP: 'ENABLE_IN_APP',
  NONE: 'NONE',
} as const;

type PushPermissionStep = (typeof PUSH_PERMISSION_STEP)[keyof typeof PUSH_PERMISSION_STEP];

export const PUSH_PROMPT_SNOOZE_DAYS = 14;

/** iOS 임시 허용(provisional·ephemeral)도 알림이 조용히 도착하므로 허용으로 본다 */
export function isDeliveryAllowed(permission: PushPermission): boolean {
  return (
    permission.status === PUSH_PERMISSION_STATUS.GRANTED ||
    permission.status === PUSH_PERMISSION_STATUS.PROVISIONAL
  );
}

function isNotDetermined(permission: PushPermission): boolean {
  return permission.status === PUSH_PERMISSION_STATUS.NOT_DETERMINED;
}

function canRequestSystemDialog(permission: PushPermission): boolean {
  return !isDeliveryAllowed(permission) && permission.canAskAgain;
}

function isBlockedUntilSettings(permission: PushPermission): boolean {
  return !isDeliveryAllowed(permission) && !permission.canAskAgain;
}

function isPromptSnoozed(dismissedAt: Date | null, now: Date): boolean {
  if (dismissedAt == null) {
    return false;
  }
  return now.getTime() - dismissedAt.getTime() < PUSH_PROMPT_SNOOZE_DAYS * DAY_MS;
}

/** 알림을 받으려면 사용자가 다음에 무엇을 해야 하는지 정한다. 문구·화면은 컴포넌트가 정한다 */
function getNextPushPermissionStep(
  permission: PushPermission,
  { pushEnabled }: { pushEnabled: boolean },
): PushPermissionStep {
  return match(permission)
    .when(isDeliveryAllowed, () =>
      pushEnabled ? PUSH_PERMISSION_STEP.NONE : PUSH_PERMISSION_STEP.ENABLE_IN_APP,
    )
    .when(isBlockedUntilSettings, () => PUSH_PERMISSION_STEP.OPEN_SETTINGS)
    .when(isNotDetermined, () => PUSH_PERMISSION_STEP.ASK)
    .otherwise(() => PUSH_PERMISSION_STEP.REQUEST_SYSTEM);
}

export const PushPermissionPolicy = {
  isDeliveryAllowed,
  isNotDetermined,
  canRequestSystemDialog,
  isBlockedUntilSettings,
  isPromptSnoozed,
  nextStep: getNextPushPermissionStep,
} as const;
