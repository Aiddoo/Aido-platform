import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";

import { internalServerError } from "./system.errors.js";

// 옛 필터 응답은 이메일을 비운 채 EMAIL_0501을 보냈다
function emailAlreadyRegistered(): ApplicationException {
  return new ApplicationException(ErrorCode.EMAIL_0501, { email: "" });
}

function userTagCollision(): ApplicationException {
  return internalServerError({ detail: "userTag collision" });
}

/**
 * 저장소가 아직 번역하지 않는 unique 제약 → 업무 오류. 키는 제약 이름과 옛 컬럼 묶음 이름이다.
 * 각 Context가 저장소에서 `isUniqueConstraintViolation`으로 자기 제약을 번역하면 그 항목을 지운다.
 */
export const LEGACY_CONSTRAINT_ERRORS: Readonly<Record<string, () => ErrorCodedException>> = {
  User_email_key: emailAlreadyRegistered,
  email: emailAlreadyRegistered,
  User_userTag_key: userTagCollision,
  userTag: userTagCollision,
};
