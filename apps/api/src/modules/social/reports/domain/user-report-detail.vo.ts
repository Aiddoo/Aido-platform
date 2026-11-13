import { USER_REPORT_LIMITS } from "@aido/api/vocabulary";

import { ValueObject } from "#api/shared/domain/model/value-object";

import { reportDetailTooLong } from "./reports.errors.js";

// 신고자가 덧붙인 설명. 공백만 있으면 설명이 없는 것(null)으로 본다
export class UserReportDetail extends ValueObject<string | null> {
  static create(raw?: string | null): UserReportDetail {
    const trimmed = raw?.trim() ?? "";
    if (trimmed.length === 0) {
      return new UserReportDetail(null);
    }
    if (trimmed.length > USER_REPORT_LIMITS.MAX_DETAIL_LENGTH) {
      throw reportDetailTooLong();
    }
    return new UserReportDetail(trimmed);
  }

  static reconstitute(raw: string | null): UserReportDetail {
    return new UserReportDetail(raw);
  }
}
