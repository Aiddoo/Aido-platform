import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

/** 저장된 상태가 아는 값이 아니다. 데이터 오류라 500이다 */
export function unknownFriendshipStatus(value: string): DomainException {
  return new DomainException(ErrorCode.SYS_0001, { detail: "Unknown friendship status", value });
}

export function invalidUserSearchTerm(query: string): DomainException {
  return new DomainException(ErrorCode.FOLLOW_0911, { query });
}

export function invalidUserTag(userTag: string): DomainException {
  return new DomainException(ErrorCode.SYS_0002, { userTag });
}
