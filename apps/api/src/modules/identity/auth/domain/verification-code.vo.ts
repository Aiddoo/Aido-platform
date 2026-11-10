import { ValueObject } from "#api/shared/domain/model/value-object";

/** 발급된 평문 인증 코드와 저장용 해시를 함께 보관한다. */
export class VerificationCode extends ValueObject<string> {
  readonly #digest: string;

  constructor(plaintext: string, digest: string) {
    super(plaintext);
    this.#digest = digest;
  }

  static create(plaintext: string, digest: string): VerificationCode {
    return new VerificationCode(plaintext, digest);
  }

  get hash(): string {
    return this.#digest;
  }
}
