import { normalizeInviteCode } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { INVITE_CODE_PATTERN } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

const INVITE_CODE_REGEX = new RegExp(INVITE_CODE_PATTERN);

export class InviteCode {
  private constructor(private readonly code: string) {}

  /** 붙여 넣은 공백·하이픈·소문자를 정규화한 뒤 6자 알파벳 규칙을 검증한다. */
  static of(raw: string): InviteCode {
    const normalized = normalizeInviteCode(raw);
    if (!INVITE_CODE_REGEX.test(normalized)) {
      throw new DomainException(ErrorCode.SYS_0002, { field: "inviteCode" });
    }
    return new InviteCode(normalized);
  }

  get value(): string {
    return this.code;
  }

  equals(other: InviteCode): boolean {
    return this.code === other.code;
  }
}
