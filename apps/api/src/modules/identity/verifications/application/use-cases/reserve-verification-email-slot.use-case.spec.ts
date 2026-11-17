import { ErrorCode } from "@aido/api/errors";

import { InMemoryVerificationEmailCap } from "#test/doubles/identity/in-memory-verification-email-cap";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { AUTH_FIXTURE_NOW } from "#test/fixtures/identity/session.fixture";

import { ReserveVerificationEmailSlotUseCase } from "./reserve-verification-email-slot.use-case.js";

const EMAIL = "user@example.com";

function setUp() {
  const clock = new FixedClock(AUTH_FIXTURE_NOW);
  const useCase = new ReserveVerificationEmailSlotUseCase({
    verificationEmailCap: new InMemoryVerificationEmailCap(),
    clock,
  });
  return { clock, useCase };
}

async function requestEveryMinute(fixture: ReturnType<typeof setUp>, count: number): Promise<void> {
  for (let request = 0; request < count; request += 1) {
    await fixture.useCase.execute({ email: EMAIL });
    fixture.clock.advanceBy({ minutes: 1 });
  }
}

describe("ReserveVerificationEmailSlot — 이메일마다 24시간 코드 상한", () => {
  it("한 시간에 세 번 요청하는 보통 사용은 막지 않는다", async () => {
    // Given
    const fixture = setUp();

    // When
    const results = [];
    for (let request = 0; request < 3; request += 1) {
      results.push(await fixture.useCase.execute({ email: EMAIL }));
      fixture.clock.advanceBy({ minutes: 20 });
    }

    // Then
    expect(results).toEqual([undefined, undefined, undefined]);
  });

  it("24시간 안의 11번째 요청은 VERIFY_0753과 첫 요청이 창을 벗어날 때까지 남은 초다", async () => {
    // Given
    const fixture = setUp();
    await requestEveryMinute(fixture, 10);

    // When
    const capped = fixture.useCase.execute({ email: "USER@example.com" });

    // Then
    await expect(capped).rejects.toMatchObject({
      errorCode: ErrorCode.VERIFY_0753,
      details: { remainingSeconds: 24 * 60 * 60 - 10 * 60 },
    });
  });

  it("첫 요청이 24시간 창을 벗어나면 다시 보낼 수 있다", async () => {
    // Given
    const fixture = setUp();
    await requestEveryMinute(fixture, 10);
    fixture.clock.advanceBy({ minutes: 24 * 60 - 10 });

    // When
    const afterWindow = fixture.useCase.execute({ email: EMAIL });

    // Then
    await expect(afterWindow).resolves.toBeUndefined();
  });

  it("상한에 걸린 요청은 세지 않아 막는 시각이 뒤로 밀리지 않는다", async () => {
    // Given
    const fixture = setUp();
    await requestEveryMinute(fixture, 10);
    for (let retry = 0; retry < 3; retry += 1) {
      await fixture.useCase.execute({ email: EMAIL }).catch(() => undefined);
    }
    fixture.clock.advanceBy({ minutes: 24 * 60 - 10 });

    // When
    const afterWindow = fixture.useCase.execute({ email: EMAIL });

    // Then
    await expect(afterWindow).resolves.toBeUndefined();
  });
});
