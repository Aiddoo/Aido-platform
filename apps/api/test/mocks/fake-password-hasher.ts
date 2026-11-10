import * as argon2 from "argon2";

import type { AuthPasswordHasherPort } from "#api/modules/identity/auth/application/ports/auth-crypto.port";

const TEST_HASH_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 1_024,
  timeCost: 1,
  parallelism: 1,
};

/** 실제 argon2id 형식을 유지하되 테스트에서는 해시 비용만 낮춘다. */
export class FakePasswordHasher implements AuthPasswordHasherPort {
  hash(password: string): Promise<string> {
    return argon2.hash(password, TEST_HASH_OPTIONS);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  needsRehash(): boolean {
    return false;
  }
}
