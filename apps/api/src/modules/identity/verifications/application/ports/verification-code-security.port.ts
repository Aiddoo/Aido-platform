export interface GeneratedVerificationCode {
  plaintext: string;
  digest: string;
}

export abstract class VerificationCodeSecurityPort {
  abstract generate(): GeneratedVerificationCode;
  abstract hash(plaintext: string): string;
}
