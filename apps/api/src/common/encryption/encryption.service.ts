import {
	createCipheriv,
	createDecipheriv,
	randomBytes,
	scryptSync,
} from "node:crypto";
import { Injectable } from "@nestjs/common";
import { TypedConfigService } from "@/common/config/services/config.service";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SALT = "aido-token-encryption";

@Injectable()
export class EncryptionService {
	readonly #key: Buffer;

	constructor(configService: TypedConfigService) {
		this.#key = scryptSync(configService.tokenEncryptionKey, SALT, KEY_LENGTH);
	}

	encrypt(plaintext: string): string {
		const iv = randomBytes(IV_LENGTH);
		const cipher = createCipheriv(ALGORITHM, this.#key, iv, {
			authTagLength: AUTH_TAG_LENGTH,
		});

		const encrypted = Buffer.concat([
			cipher.update(plaintext, "utf8"),
			cipher.final(),
		]);
		const authTag = cipher.getAuthTag();

		return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
	}

	decrypt(ciphertext: string): string {
		const parts = ciphertext.split(":");
		if (parts.length !== 3) {
			throw new Error("Invalid ciphertext format");
		}

		const [ivB64, authTagB64, encryptedB64] = parts as [string, string, string];
		const iv = Buffer.from(ivB64, "base64");
		const authTag = Buffer.from(authTagB64, "base64");
		const encrypted = Buffer.from(encryptedB64, "base64");

		const decipher = createDecipheriv(ALGORITHM, this.#key, iv, {
			authTagLength: AUTH_TAG_LENGTH,
		});
		decipher.setAuthTag(authTag);

		return Buffer.concat([
			decipher.update(encrypted),
			decipher.final(),
		]).toString("utf8");
	}

	isEncrypted(value: string): boolean {
		const parts = value.split(":");
		if (parts.length !== 3) return false;

		try {
			for (const part of parts) {
				Buffer.from(part, "base64");
			}
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * 암호화된 값이면 복호화, 평문이면 그대로 반환 (마이그레이션 호환)
	 */
	decryptSafe(value: string): string {
		if (this.isEncrypted(value)) {
			return this.decrypt(value);
		}
		return value;
	}
}
