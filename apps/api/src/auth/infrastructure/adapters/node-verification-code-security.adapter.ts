import { createHash, randomInt } from "node:crypto";
import { VERIFICATION_CODE } from "@aido/validators";
import { Injectable } from "@nestjs/common";
import type {
	GeneratedVerificationCode,
	VerificationCodeSecurityPort,
} from "../../application/ports/verification-code-security.port";

@Injectable()
export class NodeVerificationCodeSecurityAdapter
	implements VerificationCodeSecurityPort
{
	generate(): GeneratedVerificationCode {
		const minimum = 10 ** (VERIFICATION_CODE.LENGTH - 1);
		const maximum = 10 ** VERIFICATION_CODE.LENGTH;
		const plaintext = randomInt(minimum, maximum).toString();
		return { plaintext, digest: this.hash(plaintext) };
	}

	hash(plaintext: string): string {
		return createHash("sha256").update(plaintext).digest("hex");
	}
}
