import { z } from "zod";

import { ValueObject } from "#api/shared/domain/model/value-object";

import { invalidEmail } from "./auth.errors.js";

// 계약 emailSchema와 같은 형식 규칙(z.email + 255자)이다. 정규화는 계약이 이미 했으므로 다시 하지 않는다
const EMAIL_FORMAT = z.email().pipe(z.string().max(255));

// 소셜 로그인의 합성 이메일(provider_id@social.aido.kr)은 이 VO를 거치지 않는다
export class Email extends ValueObject<string> {
  static create(value: string): Email {
    const result = EMAIL_FORMAT.safeParse(value);
    if (!result.success) {
      throw invalidEmail(value);
    }
    return new Email(result.data);
  }
}
