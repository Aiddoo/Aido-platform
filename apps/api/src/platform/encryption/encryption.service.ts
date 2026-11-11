import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";

import { encryptionConfig } from "#api/platform/config/encryption.config";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
// salt는 비밀이 아니고(비밀은 TOKEN_ENCRYPTION_KEY) 운영 암호문이 이 값으로 만들어져 바꾸면 복호할 수 없다.
const DEFAULT_SALT = "aido-token-encryption";

@Injectable()
export class EncryptionService {
  readonly #key: Buffer;

  constructor(@Inject(encryptionConfig.KEY) config: ConfigType<typeof encryptionConfig>) {
    this.#key = scryptSync(config.key, config.salt ?? DEFAULT_SALT, KEY_LENGTH);
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.#key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
  }

  decrypt(ciphertext: string): string {
    const [ivB64, authTagB64, encryptedB64, ...rest] = ciphertext.split(":");
    if (ivB64 == null || authTagB64 == null || encryptedB64 == null || rest.length > 0) {
      throw new Error("Invalid ciphertext format");
    }

    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(authTagB64, "base64");
    const encrypted = Buffer.from(encryptedB64, "base64");

    const decipher = createDecipheriv(ALGORITHM, this.#key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  }

  isEncrypted(value: string): boolean {
    return value.split(":").length === 3;
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
