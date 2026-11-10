import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import { suppressLogger } from "#test/setup/suppress-logger";

import { NotifyEndingPremiumGrantsUseCase } from "../../../premium-grants/application/use-cases/notify-ending-premium-grants.use-case.js";
import { SweepPremiumGrantsUseCase } from "../../../premium-grants/application/use-cases/sweep-premium-grants.use-case.js";
import { NotifyEndingTrialsUseCase } from "../../application/use-cases/notify-ending-trials.use-case.js";
import { NotifyUpcomingRenewalsUseCase } from "../../application/use-cases/notify-upcoming-renewals.use-case.js";
import { PremiumGrantSweepProcessor } from "./premium-grant-sweep.processor.js";

const NOW = Temporal.Instant.from("2027-01-04T12:00:00.000Z");
const NOTICE_RESULT = { notifiedCount: 0, deferredCount: 0, skippedCount: 0, hasRemaining: false };
const SWEEP_RESULT = {
  userCount: 0,
  changedGrantCount: 0,
  failedUserCount: 0,
  hasRemaining: false,
  lapsedUserCount: 0,
  lapsedFailedUserCount: 0,
  hasRemainingLapsed: false,
};

// UseCase 의존성은 만들지 않고 execute만 대신하는 인스턴스를 만든다
function useCaseInstance<TUseCase extends object>(type: {
  readonly prototype: TUseCase;
}): TUseCase {
  return Object.create(type.prototype);
}

function createProcessor(failing: { readonly step: string; readonly error: Error } | null) {
  const ran: string[] = [];
  const nows: Temporal.Instant[] = [];
  const run = async (step: string, now: Temporal.Instant) => {
    ran.push(step);
    nows.push(now);
    if (failing?.step === step) {
      throw failing.error;
    }
  };

  const sweep = useCaseInstance(SweepPremiumGrantsUseCase);
  vi.spyOn(sweep, "execute").mockImplementation(async ({ now }) => {
    await run("sweep", now);
    return SWEEP_RESULT;
  });
  const ending = useCaseInstance(NotifyEndingPremiumGrantsUseCase);
  vi.spyOn(ending, "execute").mockImplementation(async ({ now }) => {
    await run("premium-grant-ending", now);
    return NOTICE_RESULT;
  });
  const trials = useCaseInstance(NotifyEndingTrialsUseCase);
  vi.spyOn(trials, "execute").mockImplementation(async ({ now }) => {
    await run("trial-ending", now);
    return NOTICE_RESULT;
  });
  const renewals = useCaseInstance(NotifyUpcomingRenewalsUseCase);
  vi.spyOn(renewals, "execute").mockImplementation(async ({ now }) => {
    await run("renewal-upcoming", now);
    return NOTICE_RESULT;
  });

  const processor = new PremiumGrantSweepProcessor(
    sweep,
    ending,
    trials,
    renewals,
    new InMemoryJobQueue(),
    new FixedClock(NOW),
  );
  return { processor, ran, nows };
}

describe("PremiumGrantSweepProcessor — 보상 정리와 결제 안내 주기", () => {
  beforeEach(suppressLogger);

  it("정리를 먼저 하고 안내 단계를 같은 시계의 지금으로 차례로 돌린다", async () => {
    // Given
    const { processor, ran, nows } = createProcessor(null);

    // When
    await processor.process();

    // Then
    expect(ran).toEqual(["sweep", "premium-grant-ending", "trial-ending", "renewal-upcoming"]);
    expect(nows).toEqual([NOW, NOW, NOW, NOW]);
  });

  it("한 안내 단계가 실패해도 다음 안내를 보내고 잡은 실패로 끝내 재시도에 맡긴다", async () => {
    // Given
    const failure = new Error("trial notice failed");
    const { processor, ran } = createProcessor({ step: "trial-ending", error: failure });

    // When
    const processed = processor.process();

    // Then
    await expect(processed).rejects.toBe(failure);
    expect(ran).toEqual(["sweep", "premium-grant-ending", "trial-ending", "renewal-upcoming"]);
  });

  it("정리가 실패하면 안내 단계를 돌리지 않고 던진다", async () => {
    // Given
    const failure = new Error("sweep failed");
    const { processor, ran } = createProcessor({ step: "sweep", error: failure });

    // When
    const processed = processor.process();

    // Then
    await expect(processed).rejects.toBe(failure);
    expect(ran).toEqual(["sweep"]);
  });
});
