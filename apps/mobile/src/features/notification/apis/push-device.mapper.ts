import type { PushDeviceResponse, ReportPushDeviceInput } from '@aido/api';
import { toInstant } from '@src/shared/date/instant';

import type { PushDevice, PushPermission } from '../domains/push-permission.model';

const PUSH_PAYLOAD_VERSION = 2;

export function toReportPushDeviceRequest({
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
