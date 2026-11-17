import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function invalidEmail(value: string): DomainException {
  return new DomainException(ErrorCode.SYS_0002, { email: value });
}

const IDENTITY_PERSISTENCE_CONFLICT_KINDS = [
  "EMAIL_ALREADY_EXISTS",
  "OAUTH_ACCOUNT_ALREADY_LINKED",
] as const;
export type IdentityPersistenceConflictKind = (typeof IDENTITY_PERSISTENCE_CONFLICT_KINDS)[number];

/** 저장소가 자기 unique 제약 위반을 번역해 던지고 UseCase가 업무 오류로 바꾼다 */
export class IdentityPersistenceConflict extends Error {
  readonly kind: IdentityPersistenceConflictKind;

  constructor(kind: IdentityPersistenceConflictKind) {
    super(kind);
    this.kind = kind;
    this.name = IdentityPersistenceConflict.name;
  }
}

// 그사이 다른 요청이 같은 공급자 계정을 먼저 연결했다. 부르는 쪽이 그 연결을 다시 읽어 이어 간다
export function oauthAccountLinkConflict(): IdentityPersistenceConflict {
  return new IdentityPersistenceConflict("OAUTH_ACCOUNT_ALREADY_LINKED");
}
