import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import * as argon2 from "argon2";

// Argon2id 해싱 설정 (OWASP 권장: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
const ARGON2_CONFIG = {
  MEMORY_COST: 65_536, // 64MB
  TIME_COST: 3,
  PARALLELISM: 4,
  HASH_LENGTH: 32,
} as const;

@Injectable()
export class Argon2PasswordHasherAdapter {
  readonly #hashOptions: argon2.HashOptions = {
    type: argon2.argon2id,
    memoryCost: ARGON2_CONFIG.MEMORY_COST,
    timeCost: ARGON2_CONFIG.TIME_COST,
    parallelism: ARGON2_CONFIG.PARALLELISM,
    hashLength: ARGON2_CONFIG.HASH_LENGTH,
  };
  // 상수 문자열 대신 지금 설정으로 처음 쓸 때 만들어 ARGON2_CONFIG를 바꿔도 실제 확인과 비용이 같다
  #dummyHash: Promise<string> | null = null;

  async hash(password: string): Promise<string> {
    return argon2.hash(password, this.#hashOptions);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      // 잘못된 해시 형식 등의 오류 시 false 반환
      return false;
    }
  }

  async verifyAgainstDummyHash(password: string): Promise<void> {
    this.#dummyHash ??= this.hash(randomUUID());
    await this.verify(await this.#dummyHash, password);
  }

  // 보안 파라미터가 변경되었을 때 기존 해시를 새 설정으로 재해싱해야 하는지 확인
  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, this.#hashOptions);
  }
}
