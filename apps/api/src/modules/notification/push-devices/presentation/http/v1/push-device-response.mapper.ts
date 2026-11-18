import { toIsoString } from "#api/shared/domain/time/instant";

import type { PushDeviceReport } from "../../../application/use-cases/report-push-device.use-case.js";
import type { PushDeviceResponseDto } from "./push-device.dto.js";

export const PushDeviceMapper = {
  toDto(report: PushDeviceReport): PushDeviceResponseDto {
    return {
      deviceId: report.deviceId,
      platform: report.platform,
      permission: report.permission,
      hasActiveToken: report.hasActiveToken,
      reportedAt: toIsoString(report.reportedAt),
    };
  },
};
