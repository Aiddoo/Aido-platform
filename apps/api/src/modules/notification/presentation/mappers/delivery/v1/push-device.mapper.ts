import { toISOString } from "#api/shared/domain/date/utils/format";

import type { PushDeviceReport } from "../../../../application/use-cases/delivery/report-push-device.use-case.js";
import type { PushDeviceResponseDto } from "../../../schemas/delivery/v1/index.js";

export const PushDeviceMapper = {
  toDto(report: PushDeviceReport): PushDeviceResponseDto {
    return {
      deviceId: report.deviceId,
      platform: report.platform,
      permission: report.permission,
      hasActiveToken: report.hasActiveToken,
      reportedAt: toISOString(report.reportedAt),
    };
  },
};
