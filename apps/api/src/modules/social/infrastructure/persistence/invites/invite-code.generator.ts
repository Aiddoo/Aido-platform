import { randomInt } from "node:crypto";

import { INVITE_CODE } from "@aido/api/vocabulary";
import { Injectable } from "@nestjs/common";

/** CSPRNG로 알파벳에서 균등하게 뽑는다. 바이트 나머지 방식의 치우침을 피하려고 randomInt를 쓴다. */
@Injectable()
export class InviteCodeGenerator {
  generate(): string {
    let code = "";
    for (let index = 0; index < INVITE_CODE.LENGTH; index++) {
      code += INVITE_CODE.ALPHABET[randomInt(INVITE_CODE.ALPHABET.length)];
    }
    return code;
  }
}
