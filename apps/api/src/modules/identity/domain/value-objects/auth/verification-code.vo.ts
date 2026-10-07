/** 발급된 평문 인증 코드와 저장용 해시를 함께 보관한다. */
export class VerificationCode {
  private constructor(
    private readonly plaintext: string,
    private readonly digest: string,
  ) {}

  static create(plaintext: string, digest: string): VerificationCode {
    return new VerificationCode(plaintext, digest);
  }

  get value(): string {
    return this.plaintext;
  }

  get hash(): string {
    return this.digest;
  }
}
