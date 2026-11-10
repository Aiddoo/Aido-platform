import { ApplicationExceptions } from "#api/shared/application/exceptions/application-exceptions";
import type { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";

/**
 * 저장소가 아직 번역하지 않는 unique 제약 → 업무 오류. 키는 제약 이름과 옛 컬럼 묶음 이름이다.
 * 각 Context가 저장소에서 `isUniqueConstraintViolation`으로 자기 제약을 번역하면 그 항목을 지운다.
 */
export const LEGACY_CONSTRAINT_ERRORS: Readonly<Record<string, () => ErrorCodedException>> = {
  User_email_key: () => ApplicationExceptions.emailAlreadyRegistered(""),
  email: () => ApplicationExceptions.emailAlreadyRegistered(""),
  User_userTag_key: () =>
    ApplicationExceptions.internalServerError({ detail: "userTag collision" }),
  userTag: () => ApplicationExceptions.internalServerError({ detail: "userTag collision" }),
  Follow_followerId_followingId_key: () => ApplicationExceptions.followRequestAlreadySent(""),
  followerId_followingId: () => ApplicationExceptions.followRequestAlreadySent(""),
};
