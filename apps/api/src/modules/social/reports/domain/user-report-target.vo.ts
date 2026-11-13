import type { UserReportTargetType } from "@aido/api/vocabulary";
import { match } from "ts-pattern";
import { z } from "zod";

import { isEntityId } from "#api/shared/domain/model/entity-id";
import { ValueObject } from "#api/shared/domain/model/value-object";

import { invalidReportTarget } from "./reports.errors.js";

const positiveIntegerIdSchema = z.string().regex(/^[1-9]\d{0,15}$/);

interface UserReportTargetValue {
  readonly type: UserReportTargetType;
  readonly contentId: string | null;
}

// 프로필은 사용자 자체를 가리켜 콘텐츠 id가 없고, 나머지는 대상 테이블의 id 형식을 따른다
export class UserReportTarget extends ValueObject<UserReportTargetValue> {
  static create(raw: UserReportTargetValue): UserReportTarget {
    const { type, contentId } = raw;
    const isValid = match(type)
      .with("PROFILE", () => contentId == null)
      .with(
        "TODO",
        "NUDGE_MESSAGE",
        "CHEER_MESSAGE",
        () => positiveIntegerIdSchema.safeParse(contentId).success,
      )
      .with("COMMENT", () => isEntityId(contentId))
      .exhaustive();
    if (!isValid) {
      throw invalidReportTarget(type);
    }
    return new UserReportTarget({ type, contentId });
  }

  static reconstitute(raw: UserReportTargetValue): UserReportTarget {
    return new UserReportTarget({ type: raw.type, contentId: raw.contentId });
  }

  get type(): UserReportTargetType {
    return this.value.type;
  }

  get contentId(): string | null {
    return this.value.contentId;
  }
}
