import RedisMock from "ioredis-mock";
import { vi } from "vitest";

import { TEST_CUID } from "#test/fixtures/id.fixture";

import { RedisPushRateLimiterAdapter } from "./redis-push-rate-limiter.adapter.js";

describe("RedisPushRateLimiterAdapter — batch 발송 한도 정책", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("여러 사용자의 일반·참여 유도 제한을 단일 원자적 Redis 호출로 예약한다", async () => {
    // Given
    const redis = new RedisMock();
    const evaluate = vi.spyOn(redis, "eval").mockResolvedValue([0, 1, 0]);
    const limiter = new RedisPushRateLimiterAdapter(redis);

    // When
    const result = await limiter.reserveBatch([
      { userId: "user-1", dispatchId: 1, engagementLocalDate: "2026-07-16" },
      { userId: "user-2", dispatchId: 2 },
      { userId: "user-3", dispatchId: 3, engagementLocalDate: "2026-07-15" },
    ]);

    // Then
    expect(result).toEqual([false, true, false]);
    expect(evaluate).toHaveBeenCalledTimes(1);
  });

  it("Redis가 잘못된 결과를 반환하면 fail-open으로 전체 발송을 허용한다", async () => {
    // Given
    const redis = new RedisMock();
    vi.spyOn(redis, "eval").mockResolvedValue([0, "invalid"]);
    const limiter = new RedisPushRateLimiterAdapter(redis);

    // When
    const result = await limiter.reserveBatch([
      { userId: "user-1", dispatchId: 1 },
      { userId: "user-2", dispatchId: 2 },
    ]);

    // Then
    expect(result).toEqual([false, false]);
  });

  it("빈 배치는 Redis를 호출하지 않는다", async () => {
    // Given
    const redis = new RedisMock();
    const evaluate = vi.spyOn(redis, "eval");
    const limiter = new RedisPushRateLimiterAdapter(redis);

    // When
    const result = await limiter.reserveBatch([]);

    // Then
    expect(result).toEqual([]);
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("참여 유도 제한에 걸리면 일반 푸시 quota를 소비하지 않는다", async () => {
    // Given
    vi.useFakeTimers().setSystemTime(new Date("2026-07-16T10:00:00.000Z"));
    const redis = new RedisMock();
    await redis.flushall();
    await redis.hset(
      `push-engagement:${TEST_CUID.USER_1}:2026-07-16`,
      "count",
      "2",
      "lastSentAt",
      "0",
    );
    const limiter = new RedisPushRateLimiterAdapter(redis);

    // When
    const result = await limiter.reserveBatch([
      { userId: TEST_CUID.USER_1, dispatchId: 1, engagementLocalDate: "2026-07-16" },
    ]);

    // Then
    expect(result).toEqual([true]);
    expect(await redis.zcard(`push-rate:${TEST_CUID.USER_1}`)).toBe(0);
  });

  it("같은 dispatch 예약은 재시도와 새 publication generation에서도 quota를 한 번만 소비한다", async () => {
    // Given
    vi.useFakeTimers().setSystemTime(new Date("2026-07-16T10:00:00.000Z"));
    const redis = new RedisMock();
    await redis.flushall();
    const limiter = new RedisPushRateLimiterAdapter(redis);
    const request = {
      userId: TEST_CUID.USER_1,
      engagementLocalDate: "2026-07-16",
      dispatchId: 501,
    };

    // When
    await expect(limiter.reserveBatch([request])).resolves.toEqual([false]);
    await expect(limiter.reserveBatch([request])).resolves.toEqual([false]);
    await expect(limiter.reserveBatch([{ ...request, dispatchId: 502 }])).resolves.toEqual([true]);

    // Then
    expect(await redis.zcard(`push-rate:${TEST_CUID.USER_1}`)).toBe(1);
    expect(
      Number(await redis.hget(`push-engagement:${TEST_CUID.USER_1}:2026-07-16`, "count")),
    ).toBe(1);
  });

  it("단건 일반·engagement 단계도 같은 dispatch 예약을 각각 재사용한다", async () => {
    // Given
    vi.useFakeTimers().setSystemTime(new Date("2026-07-16T10:00:00.000Z"));
    const redis = new RedisMock();
    await redis.flushall();
    const limiter = new RedisPushRateLimiterAdapter(redis);
    const general = { userId: TEST_CUID.USER_1, dispatchId: 601 };
    const engagement = { ...general, localDate: "2026-07-16" };

    // When
    await expect(limiter.reserveGeneral(general)).resolves.toBe(false);
    await expect(limiter.reserveEngagement(engagement)).resolves.toBe(false);
    await expect(limiter.reserveGeneral(general)).resolves.toBe(false);
    await expect(limiter.reserveEngagement(engagement)).resolves.toBe(false);

    // Then
    expect(await redis.zcard(`push-rate:${TEST_CUID.USER_1}`)).toBe(1);
    expect(
      Number(await redis.hget(`push-engagement:${TEST_CUID.USER_1}:2026-07-16`, "count")),
    ).toBe(1);
  });

  it("batch 예약 marker는 general key 만료와 현지 날짜 변경 뒤에도 같은 dispatch를 재사용한다", async () => {
    // Given
    vi.useFakeTimers().setSystemTime(new Date("2026-07-15T23:00:00.000Z"));
    const redis = new RedisMock();
    await redis.flushall();
    const limiter = new RedisPushRateLimiterAdapter(redis);
    const original = {
      userId: TEST_CUID.USER_1,
      engagementLocalDate: "2026-07-15",
      dispatchId: 701,
    };
    await expect(limiter.reserveBatch([original])).resolves.toEqual([false]);

    // When
    vi.advanceTimersByTime(5 * 60 * 60 * 1_000);
    await expect(
      limiter.reserveBatch([{ ...original, engagementLocalDate: "2026-07-16", dispatchId: 702 }]),
    ).resolves.toEqual([false]);
    vi.advanceTimersByTime(4 * 60 * 60 * 1_000);
    await expect(
      limiter.reserveBatch([{ ...original, engagementLocalDate: "2026-07-16", dispatchId: 703 }]),
    ).resolves.toEqual([false]);

    // Then
    await expect(
      limiter.reserveBatch([{ ...original, engagementLocalDate: "2026-07-16" }]),
    ).resolves.toEqual([false]);
    await expect(
      limiter.reserveBatch([{ ...original, engagementLocalDate: "2026-07-16", dispatchId: 704 }]),
    ).resolves.toEqual([true]);
    expect(
      await redis.exists(`push-rate-reservation:general:${TEST_CUID.USER_1}:push-dispatch-701`),
    ).toBe(1);
    expect(
      await redis.exists(`push-rate-reservation:engagement:${TEST_CUID.USER_1}:push-dispatch-701`),
    ).toBe(1);
  });

  it("단건 general 예약 직후 crash한 재시도는 key 만료 뒤에도 quota를 다시 쓰지 않는다", async () => {
    // Given
    vi.useFakeTimers().setSystemTime(new Date("2026-07-15T23:00:00.000Z"));
    const redis = new RedisMock();
    await redis.flushall();
    const limiter = new RedisPushRateLimiterAdapter(redis);
    const reserved = { userId: TEST_CUID.USER_1, dispatchId: 801 };
    await expect(limiter.reserveGeneral(reserved)).resolves.toBe(false);

    // When
    vi.advanceTimersByTime(2 * 60 * 60 * 1_000);
    for (let index = 0; index < 15; index += 1) {
      await expect(
        limiter.reserveGeneral({ userId: TEST_CUID.USER_1, dispatchId: 900 + index }),
      ).resolves.toBe(false);
    }

    // Then
    await expect(
      limiter.reserveGeneral({ userId: TEST_CUID.USER_1, dispatchId: 999 }),
    ).resolves.toBe(true);
    await expect(limiter.reserveGeneral(reserved)).resolves.toBe(false);
    await expect(limiter.reserveEngagement({ ...reserved, localDate: "2026-07-16" })).resolves.toBe(
      false,
    );
  });
});
