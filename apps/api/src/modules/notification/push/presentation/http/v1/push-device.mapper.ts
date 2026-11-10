import { toISOString } from "#api/shared/domain/date/utils/format";

import type { PushDeviceResponseDto } from "../../../../inbox/presentation/http/v1/notification.dto.js";
import type { PushDeviceReport } from "../../../application/use-cases/report-push-device.use-case.js";

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
