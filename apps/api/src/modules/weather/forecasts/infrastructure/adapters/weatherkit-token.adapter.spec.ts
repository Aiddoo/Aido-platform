import { Logger } from "@nestjs/common";
import { decodeJwt, decodeProtectedHeader, exportPKCS8, generateKeyPair, jwtVerify } from "jose";

import { FakeTimerClock } from "#test/doubles/platform/fake-timer-clock";

import {
  WeatherKitNotConfiguredError,
  WeatherKitTokenAdapter,
} from "./weatherkit-token.adapter.js";

const CREDENTIALS = {
  teamId: "TEAM123456",
  keyId: "KEY1234567",
  serviceId: "com.example.weatherkit-client",
};

describe("WeatherKitTokenAdapter — ES256 개발자 토큰", () => {
  let publicKey: CryptoKey;
  let privateKeyPem: string;

  beforeAll(async () => {
    const pair = await generateKeyPair("ES256", { extractable: true });
    publicKey = pair.publicKey;
    privateKeyPem = await exportPKCS8(pair.privateKey);
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-02T06:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function createResolver() {
    let signCount = 0;
    const configService = {
      get weatherKit() {
        signCount += 1;
        return { ...CREDENTIALS, privateKey: privateKeyPem };
      },
    };
    return {
      resolver: new WeatherKitTokenAdapter(configService, new FakeTimerClock()),
      signCount: () => signCount,
    };
  }

  it("Apple 형식의 header·claim으로 1시간짜리 토큰을 서명한다", async () => {
    // Given
    const { resolver } = createResolver();
    // When
    const token = await resolver.resolve();
    // Then
    await expect(jwtVerify(token, publicKey, { currentDate: new Date() })).resolves.toBeDefined();
    expect(decodeProtectedHeader(token)).toEqual({
      alg: "ES256",
      kid: "KEY1234567",
      id: "TEAM123456.com.example.weatherkit-client",
    });
    const claims = decodeJwt(token);
    expect(claims).toMatchObject({ iss: "TEAM123456", sub: "com.example.weatherkit-client" });
    expect((claims.exp ?? 0) - (claims.iat ?? 0)).toBe(3_600);
  });

  it("만료 5분 전까지는 같은 토큰을 재사용한다", async () => {
    // Given
    const { resolver, signCount } = createResolver();
    const first = await resolver.resolve();
    vi.setSystemTime(new Date("2026-11-02T06:54:59.000Z"));
    // When
    const second = await resolver.resolve();
    // Then
    expect(second).toBe(first);
    expect(signCount()).toBe(1);
  });

  it("만료 5분 전이 지나면 새로 서명한다", async () => {
    // Given
    const { resolver, signCount } = createResolver();
    const first = await resolver.resolve();
    vi.setSystemTime(new Date("2026-11-02T06:55:00.000Z"));
    // When
    const second = await resolver.resolve();
    // Then
    expect(second).not.toBe(first);
    expect(signCount()).toBe(2);
  });

  it("공급자가 거절해 무효화하면 만료 전이라도 새로 서명한다", async () => {
    // Given
    const { resolver, signCount } = createResolver();
    const first = await resolver.resolve();
    vi.setSystemTime(new Date("2026-11-02T06:00:01.000Z"));
    // When
    resolver.invalidate();
    const second = await resolver.resolve();
    // Then
    expect(second).not.toBe(first);
    expect(signCount()).toBe(2);
  });

  it("동시에 들어온 요청은 서명 한 번을 공유한다", async () => {
    // Given
    const { resolver, signCount } = createResolver();
    // When
    const tokens = await Promise.all([resolver.resolve(), resolver.resolve(), resolver.resolve()]);
    // Then
    expect(new Set(tokens).size).toBe(1);
    expect(signCount()).toBe(1);
  });

  it("자격이 없으면 설정 오류이며 다음 호출에서 다시 확인한다", async () => {
    // Given
    const resolver = new WeatherKitTokenAdapter({ weatherKit: null }, new FakeTimerClock());
    // When
    const first = resolver.resolve();
    const second = resolver.resolve();
    // Then
    await expect(first).rejects.toBeInstanceOf(WeatherKitNotConfiguredError);
    await expect(second).rejects.toBeInstanceOf(WeatherKitNotConfiguredError);
  });

  it("서명 로그에 토큰과 개인 키를 남기지 않는다", async () => {
    // Given
    const debugSpy = vi.spyOn(Logger.prototype, "debug").mockImplementation(() => undefined);
    const { resolver } = createResolver();
    // When
    const token = await resolver.resolve();
    // Then
    expect(debugSpy).toHaveBeenCalledWith({
      event: "weather.weatherkit.token_signed",
      expiresAt: "2026-11-02T07:00:00.000Z",
    });
    const logged = JSON.stringify(debugSpy.mock.calls);
    expect(logged).not.toContain(token);
    expect(logged).not.toContain("PRIVATE KEY");
  });
});
