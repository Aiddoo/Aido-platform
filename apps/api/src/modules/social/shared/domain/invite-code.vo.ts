import { INVITE_CODE_PATTERN } from "@aido/api/vocabulary";

import { ValueObject } from "#api/shared/domain/model/value-object";

import { invalidInviteCode } from "./social.errors.js";

const INVITE_CODE_REGEX = new RegExp(INVITE_CODE_PATTERN);

// 계약의 normalizeInviteCode와 같은 규칙이어야 앱이 보낸 코드와 같은 코드로 읽는다(Domain은 계약 패키지를 모른다)
function normalizeInviteCode(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

export class InviteCode extends ValueObject<string> {
  // 붙여 넣은 공백·하이픈·소문자를 정규화한 뒤 6자 알파벳 규칙을 검증한다
  static create(raw: string): InviteCode {
    const normalized = normalizeInviteCode(raw);
    if (!INVITE_CODE_REGEX.test(normalized)) {
      throw invalidInviteCode();
    }
    return new InviteCode(normalized);
  }

  static reconstitute(raw: string): InviteCode {
    return new InviteCode(raw);
  }
}
