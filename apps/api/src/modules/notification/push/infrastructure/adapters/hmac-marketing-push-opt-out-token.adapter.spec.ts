import { createHmac } from "node:crypto";

import { vi } from "vitest";

import { HmacMarketingPushOptOutTokenAdapter } from "./hmac-marketing-push-opt-out-token.adapter.js";

const secret = "test-jwt-secret-at-least-32-characters";
const currentKey = "current-opt-out-key-at-least-32-characters";
const previousKey = "previous-opt-out-key-at-least-32-characters";

function createAdapter(
  optOutTokenSigningKeys?: string,
  jwtSecret = secret,
): HmacMarketingPushOptOutTokenAdapter {
  return new HmacMarketingPushOptOutTokenAdapter({
    optOutTokenSigning: { configured: optOutTokenSigningKeys, legacySecret: jwtSecret },
  });
}

describe("HmacMarketingPushOptOutTokenAdapter", () => {
  let adapter: HmacMarketingPushOptOutTokenAdapter;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T12:00:00.000Z"));
    adapter = createAdapter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("발급한 토큰에서 사용자 ID를 복원한다", () => {
    const token = adapter.issue("user.with.dots");

    expect(adapter.verify(token)).toBe("user.with.dots");
  });

  it("서명이 변조된 토큰을 거부한다", () => {
    const token = adapter.issue("user-1");
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

    expect(adapter.verify(tampered)).toBeNull();
  });

  it("90일 유효기간이 지난 토큰을 기기 시각과 무관하게 거부한다", () => {
    const token = adapter.issue("user-1");
    vi.advanceTimersByTime(90 * 24 * 60 * 60 * 1000 + 1000);

    expect(adapter.verify(token)).toBeNull();
  });

  it("새 서명 키가 없으면 배포 전과 바이트 단위로 같은 토큰을 만든다", () => {
    // Given
    const expiresAt = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;
    const payload = Buffer.from(`user-1.${expiresAt}`).toString("base64url");
    const signature = createHmac("sha256", secret)
      .update(`marketing-push-opt-out:${payload}`)
      .digest("base64url");

    // When
    const token = adapter.issue("user-1");

    // Then
    expect(token).toBe(`${payload}.${signature}`);
  });

  it("새 서명 키를 넣으면 kid를 싣고, 이미 보낸 JWT_SECRET 토큰과 이전 kid 토큰도 받는다", () => {
    // Given
    const legacyToken = adapter.issue("legacy-user");
    const previousToken = createAdapter(`k1:${previousKey}`).issue("previous-user");
    const rotated = createAdapter(`k2:${currentKey},k1:${previousKey}`);

    // When
    const token = rotated.issue("user-1");

    // Then
    expect(token.split(".")[0]).toBe("k2");
    expect(rotated.verify(token)).toBe("user-1");
    expect(rotated.verify(legacyToken)).toBe("legacy-user");
    expect(rotated.verify(previousToken)).toBe("previous-user");
  });

  it("모르는 kid, 다른 JWT_SECRET, kid 없는 설정에서 연 새 토큰을 거부한다", () => {
    // Given
    const keyedToken = createAdapter(`k1:${previousKey}`).issue("user-1");
    const legacyToken = adapter.issue("user-1");

    // When
    const results = [
      createAdapter(`k2:${currentKey}`).verify(keyedToken),
      adapter.verify(keyedToken),
      createAdapter(undefined, "another-jwt-secret-at-least-32-characters").verify(legacyToken),
    ];

    // Then
    expect(results).toEqual([null, null, null]);
  });
});
