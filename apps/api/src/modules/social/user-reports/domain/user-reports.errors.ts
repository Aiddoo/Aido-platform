import { ErrorCode } from "@aido/api/errors";
import { USER_REPORT_LIMITS } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function reportDetailTooLong(): DomainException {
  return new DomainException(ErrorCode.SYS_0002, {
    maxLength: USER_REPORT_LIMITS.MAX_DETAIL_LENGTH,
  });
}

export function resolutionNoteLengthOutOfRange(): DomainException {
  return new DomainException(ErrorCode.SYS_0002, {
    maxLength: USER_REPORT_LIMITS.MAX_RESOLUTION_NOTE_LENGTH,
  });
}

export function invalidReportTarget(targetType: string): DomainException {
  return new DomainException(ErrorCode.REPORT_2253, { targetType });
}

export function cannotReportSelf(): DomainException {
  return new DomainException(ErrorCode.REPORT_2251);
}
