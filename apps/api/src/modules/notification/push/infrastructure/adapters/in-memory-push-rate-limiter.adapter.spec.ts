import { vi } from "vitest";

import { PUSH_RATE_LIMIT_POLICY } from "../../domain/push-rate-limit.constants.js";
import {
  InMemoryPushRateLimiterAdapter,
  PUSH_RATE_LIMIT_MAX_ENTRIES,
} from "./in-memory-push-rate-limiter.adapter.js";

const USER_ID = "user-1";

describe("InMemoryPushRateLimiterAdapter — 참여 알림 발송 한도 정책", () => {
  beforeEach(() => {
    vi.useFakeTimers().setSystemTime(new Date("2026-07-15T00:00:00.000Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("현지 하루 최대 2회, 최소 4시간 간격을 원자적으로 적용한다", async () => {
    // Given
    const limiter = new InMemoryPushRateLimiterAdapter();
    const reserve = (dispatchId: number) =>
      limiter.reserveEngagement({ userId: USER_ID, localDate: "2026-07-15", dispatchId });

    // When & Then
    expect(await reserve(1)).toBe(false);
    expect(await reserve(2)).toBe(true);
    vi.advanceTimersByTime(4 * 60 * 60 * 1000);
    expect(await reserve(3)).toBe(false);
    vi.advanceTimersByTime(4 * 60 * 60 * 1000);
    expect(await reserve(4)).toBe(true);
  });

  it("48시간 지난 날짜별 참여 유도 카운터는 만료된다", async () => {
    // Given
    const limiter = new InMemoryPushRateLimiterAdapter();
    const reserve = (dispatchId: number) =>
      limiter.reserveEngagement({ userId: USER_ID, localDate: "2026-07-15", dispatchId });
    expect(await reserve(1)).toBe(false);
    vi.advanceTimersByTime(4 * 60 * 60 * 1000);
    expect(await reserve(2)).toBe(false);

    // When
    vi.advanceTimersByTime(49 * 60 * 60 * 1000);

    // Then
    expect(await reserve(3)).toBe(false);
  });

  it("배치 요청의 입력 순서를 보존하고 참여 유도 정책을 함께 적용한다", async () => {
    // Given
    const limiter = new InMemoryPushRateLimiterAdapter();

    // When & Then
    await expect(
      limiter.reserveBatch([
        { userId: USER_ID, dispatchId: 1, engagementLocalDate: "2026-07-15" },
        { userId: "user-2", dispatchId: 2 },
      ]),
    ).resolves.toEqual([false, false]);
    await expect(
      limiter.reserveBatch([
        { userId: USER_ID, dispatchId: 3, engagementLocalDate: "2026-07-15" },
        { userId: "user-2", dispatchId: 4 },
      ]),
    ).resolves.toEqual([true, false]);
  });

  it("같은 dispatch 예약은 재시도와 새 publication generation에서도 한 번만 소비한다", async () => {
    // Given
    const limiter = new InMemoryPushRateLimiterAdapter();
    const request = { userId: USER_ID, engagementLocalDate: "2026-07-15", dispatchId: 501 };

    // When & Then
    await expect(limiter.reserveBatch([request])).resolves.toEqual([false]);
    await expect(limiter.reserveBatch([request])).resolves.toEqual([false]);
    await expect(limiter.reserveBatch([{ ...request, dispatchId: 502 }])).resolves.toEqual([true]);
  });

  it("engagement 제한은 Redis 계약과 동일하게 general quota를 소비하지 않는다", async () => {
    // Given
    const limiter = new InMemoryPushRateLimiterAdapter();
    const localDate = "2026-07-15";
    await limiter.reserveEngagement({ userId: USER_ID, localDate, dispatchId: 1 });

    // When
    const limited = await limiter.reserveBatch([
      { userId: USER_ID, engagementLocalDate: localDate, dispatchId: 2 },
    ]);

    // Then
    expect(limited).toEqual([true]);
    for (let index = 0; index < 15; index += 1) {
      await expect(
        limiter.reserveGeneral({ userId: USER_ID, dispatchId: 100 + index }),
      ).resolves.toBe(false);
    }
    await expect(limiter.reserveGeneral({ userId: USER_ID, dispatchId: 200 })).resolves.toBe(true);
  });

  it("단건 일반·engagement 단계도 같은 dispatch 예약을 각각 재사용한다", async () => {
    // Given
    const limiter = new InMemoryPushRateLimiterAdapter();
    const general = { userId: USER_ID, dispatchId: 601 };
    const engagement = { ...general, localDate: "2026-07-15" };

    // When & Then
    await expect(limiter.reserveGeneral(general)).resolves.toBe(false);
    await expect(limiter.reserveEngagement(engagement)).resolves.toBe(false);
    await expect(limiter.reserveGeneral(general)).resolves.toBe(false);
    await expect(limiter.reserveEngagement(engagement)).resolves.toBe(false);
  });

  it("batch 예약 marker는 general window와 현지 날짜가 바뀌어도 같은 dispatch를 재사용한다", async () => {
    // Given
    const limiter = new InMemoryPushRateLimiterAdapter();
    const original = { userId: USER_ID, engagementLocalDate: "2026-07-15", dispatchId: 701 };
    await expect(limiter.reserveBatch([original])).resolves.toEqual([false]);

    // When
    vi.advanceTimersByTime(5 * 60 * 60 * 1000);
    await expect(
      limiter.reserveBatch([{ ...original, engagementLocalDate: "2026-07-16", dispatchId: 702 }]),
    ).resolves.toEqual([false]);
    vi.advanceTimersByTime(4 * 60 * 60 * 1000);
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
  });

  it("단건 general 예약 직후 crash한 재시도는 window가 지나도 quota를 다시 쓰지 않는다", async () => {
    // Given
    const limiter = new InMemoryPushRateLimiterAdapter();
    const reserved = { userId: USER_ID, dispatchId: 801 };
    await expect(limiter.reserveGeneral(reserved)).resolves.toBe(false);

    // When
    vi.advanceTimersByTime(2 * 60 * 60 * 1000);
    for (let index = 0; index < 15; index += 1) {
      await expect(
        limiter.reserveGeneral({ userId: USER_ID, dispatchId: 900 + index }),
      ).resolves.toBe(false);
    }

    // Then
    await expect(limiter.reserveGeneral({ userId: USER_ID, dispatchId: 999 })).resolves.toBe(true);
    await expect(limiter.reserveGeneral(reserved)).resolves.toBe(false);
    await expect(limiter.reserveEngagement({ ...reserved, localDate: "2026-07-16" })).resolves.toBe(
      false,
    );
  });

  it("사용자 수가 상한을 넘으면 가장 오래 안 쓴 사용자의 발송 기록부터 잊어 크기를 상한 안에 둔다", async () => {
    // Given
    const limiter = new InMemoryPushRateLimiterAdapter();
    const fillQuota = async (userId: string, firstDispatchId: number) => {
      for (let index = 0; index < PUSH_RATE_LIMIT_POLICY.GENERAL.MAX; index += 1) {
        await limiter.reserveGeneral({ userId, dispatchId: firstDispatchId + index });
      }
    };
    await fillQuota("oldest", 1);

    // When
    for (let index = 0; index < PUSH_RATE_LIMIT_MAX_ENTRIES; index += 1) {
      await limiter.reserveGeneral({ userId: `user-${index}`, dispatchId: 100 + index });
    }
    await fillQuota("newest", 50_000);

    // Then
    await expect(limiter.reserveGeneral({ userId: "oldest", dispatchId: 60_000 })).resolves.toBe(
      false,
    );
    await expect(limiter.reserveGeneral({ userId: "newest", dispatchId: 60_001 })).resolves.toBe(
      true,
    );
  });
});
