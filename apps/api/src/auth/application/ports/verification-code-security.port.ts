export const VERIFICATION_CODE_SECURITY = Symbol("VERIFICATION_CODE_SECURITY");

export interface GeneratedVerificationCode {
	plaintext: string;
	digest: string;
}

export interface VerificationCodeSecurityPort {
	generate(): GeneratedVerificationCode;
	hash(plaintext: string): string;
}
