import { ErrorCode } from "@aido/api/errors";
import { USER_REPORT_LIMITS } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

/** 신고자가 덧붙인 설명. 공백만 있으면 설명이 없는 것으로 본다. */
export class UserReportDetail {
  private constructor(readonly value: string | null) {}

  static of(value?: string | null): UserReportDetail {
    const trimmed = value?.trim() ?? "";
    if (trimmed.length === 0) {
      return new UserReportDetail(null);
    }
    if (trimmed.length > USER_REPORT_LIMITS.MAX_DETAIL_LENGTH) {
      throw new DomainException(ErrorCode.SYS_0002, {
        maxLength: USER_REPORT_LIMITS.MAX_DETAIL_LENGTH,
      });
    }
    return new UserReportDetail(trimmed);
  }
}
