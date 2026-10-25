import { ErrorCode } from "@aido/api/errors";
import type { UserReportTargetType } from "@aido/api/vocabulary";
import { match } from "ts-pattern";
import { z } from "zod";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

const positiveIntegerIdSchema = z.string().regex(/^[1-9]\d{0,15}$/);
const commentIdSchema = z.cuid();

/**
 * 신고한 콘텐츠의 위치. 프로필은 사용자 자체를 가리켜 콘텐츠 ID가 없고, 나머지는 대상 테이블의 ID 형식을 따른다.
 */
export class UserReportTarget {
  private constructor(
    readonly type: UserReportTargetType,
    readonly contentId: string | null,
  ) {}

  static of(type: UserReportTargetType, contentId: string | null): UserReportTarget {
    const isValid = match(type)
      .with("PROFILE", () => contentId == null)
      .with(
        "TODO",
        "NUDGE_MESSAGE",
        "CHEER_MESSAGE",
        () => positiveIntegerIdSchema.safeParse(contentId).success,
      )
      .with("COMMENT", () => commentIdSchema.safeParse(contentId).success)
      .exhaustive();
    if (!isValid) {
      throw new DomainException(ErrorCode.REPORT_2253, { targetType: type });
    }
    return new UserReportTarget(type, contentId);
  }

  equals(other: UserReportTarget): boolean {
    return this.type === other.type && this.contentId === other.contentId;
  }
}
