import {
  PUSH_PERMISSION_STATUS,
  type PushDeviceResponse,
  type ReportPushDeviceInput,
} from '@aido/api';
import type { PushPermissionResponse } from '@src/core/ports/push-notification-gateway';
import { toInstant } from '@src/shared/date/instant';
import { match } from 'ts-pattern';

import type { PushDevice, PushPermission } from '../domains/push-permission.model';

const PUSH_PAYLOAD_VERSION = 2;

// iOS 임시 허용은 일반 상태가 undetermined로 오므로 iOS 세부 상태를 먼저 본다
export function toPushPermission(response: PushPermissionResponse): PushPermission {
  return {
    status: match(response)
      .with(
        { iosStatus: 'PROVISIONAL' },
        { iosStatus: 'EPHEMERAL' },
        () => PUSH_PERMISSION_STATUS.PROVISIONAL,
      )
      .with({ status: 'granted' }, () => PUSH_PERMISSION_STATUS.GRANTED)
      .with({ status: 'denied' }, () => PUSH_PERMISSION_STATUS.DENIED)
      .with({ status: 'undetermined' }, () => PUSH_PERMISSION_STATUS.NOT_DETERMINED)
      .exhaustive(),
    canAskAgain: response.canAskAgain,
  };
}

export function toReportPushDeviceInput({
  permission,
  token,
}: {
  permission: PushPermission;
  token: string | null;
}): ReportPushDeviceInput {
  return { permission, token, payloadVersion: PUSH_PAYLOAD_VERSION };
}

export function toPushDevice(dto: PushDeviceResponse): PushDevice {
  return {
    permission: dto.permission,
    hasActiveToken: dto.hasActiveToken,
    reportedAt: toInstant(dto.reportedAt),
  };
}
