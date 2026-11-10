import { createHmac, timingSafeEqual } from "node:crypto";

import type { SigningKey, SigningKeyRing } from "./signing-key-ring.js";

export interface HmacTokenDomain {
  /** kid 없는 `payload.서명` 토큰의 서명 접두사. 이미 보낸 토큰과 같아야 한다. */
  readonly legacyPrefix: string;
  /** `kid.payload.서명` 토큰은 `<keyedPrefix><kid>:`로 kid까지 서명한다. */
  readonly keyedPrefix: string;
}

/**
 * payload(`.` 없는 base64url)에 HMAC-SHA256 서명을 붙인다.
 * 현재 키가 기존 비밀값이면 배포 전과 같은 형식으로 쓰고, 검증은 두 형식을 모두 받는다.
 */
export class HmacTokenSigner {
  readonly #ring: SigningKeyRing;
  readonly #domain: HmacTokenDomain;

  constructor(ring: SigningKeyRing, domain: HmacTokenDomain) {
    this.#ring = ring;
    this.#domain = domain;
  }

  sign(payload: string): string {
    const key = this.#ring.current;
    if (key === this.#ring.legacy) {
      return `${payload}.${this.#signLegacy(key, payload)}`;
    }
    return `${key.kid}.${payload}.${this.#signKeyed(key, payload)}`;
  }

  /** 서명이 맞으면 payload를, 아니면 null을 돌려준다. */
  open(token: string): string | null {
    const parts = token.split(".");
    if (parts.some((part) => part.length === 0)) {
      return null;
    }
    const [first, second, third, extra] = parts;
    if (first == null || second == null || extra != null) {
      return null;
    }
    if (third == null) {
      const expected = this.#signLegacy(this.#ring.legacy, first);
      return isSameSignature(second, expected) ? first : null;
    }
    const key = this.#ring.find(first);
    if (key == null) {
      return null;
    }
    return isSameSignature(third, this.#signKeyed(key, second)) ? second : null;
  }

  #signLegacy(key: SigningKey, payload: string): string {
    return hmac(key.secret, `${this.#domain.legacyPrefix}${payload}`);
  }

  #signKeyed(key: SigningKey, payload: string): string {
    return hmac(key.secret, `${this.#domain.keyedPrefix}${key.kid}:${payload}`);
  }
}

function hmac(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("base64url");
}

function isSameSignature(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}
