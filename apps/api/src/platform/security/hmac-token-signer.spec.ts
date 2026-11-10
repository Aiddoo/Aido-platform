import { createHmac } from "node:crypto";

import { HmacTokenSigner } from "./hmac-token-signer.js";
import { SigningKeyRing } from "./signing-key-ring.js";

const legacySecret = "legacy-jwt-secret-at-least-32-characters";
const currentSecret = "current-signing-secret-at-least-32-chars";
const previousSecret = "previous-signing-secret-at-least-32-char";
const domain = { legacyPrefix: "sample:v1:", keyedPrefix: "sample:v2:" };
const payload = "eyJ2IjoxfQ";

function hmac(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("base64url");
}

function signerWith(configured: string | undefined): HmacTokenSigner {
  return new HmacTokenSigner(SigningKeyRing.fromEnv({ configured, legacySecret }), domain);
}

describe("HmacTokenSigner", () => {
  it("새 키가 없으면 지금과 같은 `payload.서명` 형식으로 서명한다", () => {
    // Given
    const signer = signerWith(undefined);

    // When
    const token = signer.sign(payload);

    // Then
    expect(token).toBe(`${payload}.${hmac(legacySecret, `sample:v1:${payload}`)}`);
    expect(signer.open(token)).toBe(payload);
  });

  it("새 키가 있으면 kid를 싣고 kid까지 서명한다", () => {
    // Given
    const signer = signerWith(`k2:${currentSecret},k1:${previousSecret}`);

    // When
    const token = signer.sign(payload);

    // Then
    expect(token).toBe(`k2.${payload}.${hmac(currentSecret, `sample:v2:k2:${payload}`)}`);
    expect(signer.open(token)).toBe(payload);
  });

  it("새 키를 넣은 뒤에도 기존 비밀값으로 서명한 토큰과 이전 kid 토큰을 연다", () => {
    // Given
    const legacyToken = signerWith(undefined).sign(payload);
    const previousToken = signerWith(`k1:${previousSecret}`).sign(payload);
    const signer = signerWith(`k2:${currentSecret},k1:${previousSecret}`);

    // When
    const opened = [signer.open(legacyToken), signer.open(previousToken)];

    // Then
    expect(opened).toEqual([payload, payload]);
  });

  it("모르는 kid, 바꾼 kid, 변조한 서명, 다른 비밀값은 거절한다", () => {
    // Given
    const signer = signerWith(`k2:${currentSecret},k1:${previousSecret}`);
    const token = signer.sign(payload);
    const signature = token.split(".")[2] ?? "";
    const tamperedSignature = `${signature.startsWith("a") ? "b" : "a"}${signature.slice(1)}`;

    // When
    const rejected = [
      signer.open(`k9.${payload}.${signature}`),
      signer.open(`k1.${payload}.${signature}`),
      signer.open(`k2.${payload}.${tamperedSignature}`),
      signer.open(
        `${payload}.${hmac("another-secret-at-least-32-characters!!", `sample:v1:${payload}`)}`,
      ),
      signer.open(`${payload}.${hmac(legacySecret, `other:v1:${payload}`)}`),
    ];

    // Then
    expect(rejected).toEqual([null, null, null, null, null]);
  });

  it("새 키로 서명한 토큰은 새 키가 없는 설정에서 열리지 않는다", () => {
    // Given
    const token = signerWith(`k1:${previousSecret}`).sign(payload);

    // When
    const opened = signerWith(undefined).open(token);

    // Then
    expect(opened).toBeNull();
  });

  it.each(["", ".", `${payload}.`, `.${payload}`, `k1..x`, `a.b.c.d`, `k1.${payload}.`])(
    "형식이 틀린 토큰 %j는 거절한다",
    (token) => {
      // Given
      const signer = signerWith(`k1:${previousSecret}`);

      // When
      const opened = signer.open(token);

      // Then
      expect(opened).toBeNull();
    },
  );
});
