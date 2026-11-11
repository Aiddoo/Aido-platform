import { INVITE_CODE } from "@aido/api/vocabulary";

import { InviteCodeGeneratorPort } from "#api/modules/social/invites/application/ports/invite-code-generator.port";
import { InviteCode } from "#api/modules/social/invites/domain/invite-code.vo";

// 정해 둔 코드를 순서대로 주고, 다 쓰면 알파벳에서 겹치지 않는 코드를 차례로 만든다
export class StubInviteCodeGenerator extends InviteCodeGeneratorPort {
  #codes: string[];
  #sequence = 0;

  constructor(codes: readonly string[] = []) {
    super();
    this.#codes = [...codes];
  }

  use(codes: readonly string[]): void {
    this.#codes = [...codes];
  }

  generate(): InviteCode {
    const next = this.#codes.shift();
    if (next != null) {
      return InviteCode.create(next);
    }
    this.#sequence += 1;
    let remaining = this.#sequence;
    let code = "";
    for (let index = 0; index < INVITE_CODE.LENGTH; index++) {
      code += INVITE_CODE.ALPHABET[remaining % INVITE_CODE.ALPHABET.length];
      remaining = Math.floor(remaining / INVITE_CODE.ALPHABET.length);
    }
    return InviteCode.create(code);
  }
}
