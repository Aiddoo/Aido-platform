import { PushThroughputLimiterAdapter } from "./push-throughput-limiter.adapter.js";

function createClock() {
  let nowMs = 0;
  const sleeps: number[] = [];
  return {
    sleeps,
    now: () => nowMs,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      nowMs += ms;
    },
  };
}

describe("PushThroughputLimiterAdapter — 공급자 초당 한도", () => {
  it("초당 한도 안의 발송은 기다리지 않고 넘는 만큼만 기다린다", async () => {
    // Given: 초당 500건, 100건씩 7번 보낸다
    const clock = createClock();
    const limiter = new PushThroughputLimiterAdapter({ messagesPerSecond: 500, ...clock });

    // When
    for (let batch = 0; batch < 7; batch++) {
      await limiter.acquire(100);
    }

    // Then: 처음 500건은 바로, 나머지 200건은 각각 0.2초씩 기다린다
    expect(clock.sleeps).toEqual([200, 200]);
    expect(clock.now()).toBe(400);
  });

  it("동시에 요청해도 순서대로 토큰을 나눠 초당 한도를 넘지 않는다", async () => {
    // Given
    const clock = createClock();
    const limiter = new PushThroughputLimiterAdapter({ messagesPerSecond: 100, ...clock });

    // When
    await Promise.all([limiter.acquire(100), limiter.acquire(100), limiter.acquire(100)]);

    // Then
    expect(clock.now()).toBe(2000);
  });
});
