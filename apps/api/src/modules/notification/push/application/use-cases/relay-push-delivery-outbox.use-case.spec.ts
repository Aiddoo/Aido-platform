import { toIsoString } from "#api/shared/domain/time/instant";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";

import type { PushDeliveryLifecycleRepositoryPort } from "../ports/push-delivery-lifecycle.repository.port.js";
import type { PushDeliveryOutboxRepositoryPort } from "../ports/push-delivery-outbox.repository.port.js";
import type {
  PublishPushDeliveryOutboxInput,
  PublishPushDeliveryOutboxUseCase,
} from "./publish-push-delivery-outbox.use-case.js";
import { RelayPushDeliveryOutboxUseCase } from "./relay-push-delivery-outbox.use-case.js";

const NOW = Temporal.Instant.from("2026-08-29T12:00:00.000Z");

// 실행 순서를 한 목록에 남겨 stale 복구가 발행보다 먼저인지 본다
class RecordingRelaySteps
  implements
    Pick<PushDeliveryOutboxRepositoryPort, "recoverStaleProcessing">,
    Pick<PublishPushDeliveryOutboxUseCase, "execute">
{
  readonly steps: string[] = [];
  readonly publishInputs: PublishPushDeliveryOutboxInput[] = [];
  publishedPerBatch = 0;

  readonly lifecycle: Pick<PushDeliveryLifecycleRepositoryPort, "recoverStaleProcessing"> = {
    recoverStaleProcessing: async (startedBefore: Temporal.Instant) => {
      this.steps.push(`lifecycle-recover:${toIsoString(startedBefore)}`);
      return 0;
    },
  };

  async recoverStaleProcessing(lockedBefore: Temporal.Instant): Promise<number> {
    this.steps.push(`outbox-recover:${toIsoString(lockedBefore)}`);
    return 0;
  }

  async execute(input: PublishPushDeliveryOutboxInput): Promise<number> {
    this.steps.push("publish");
    this.publishInputs.push(input);
    return this.publishedPerBatch;
  }
}

function createRelayUseCase(steps: RecordingRelaySteps) {
  return new RelayPushDeliveryOutboxUseCase({
    outbox: steps,
    lifecycle: steps.lifecycle,
    unitOfWork: new ImmediateUnitOfWork(),
    publishOutbox: steps,
    pushProvider: {
      timing: {
        receipt: { readyAfterMs: 15 * 60_000, retentionMs: 24 * 60 * 60_000 },
        unabortableSendGraceMs: 10 * 60_000,
      },
    },
    clock: new FixedClock(NOW),
  });
}

describe("RelayPushDeliveryOutboxUseCase — stale recovery와 relay", () => {
  it("작업 만료 5분에 공급자 전송 여유 10분을 더한 15분 lease로 먼저 복구한 뒤 available batch를 발행한다", async () => {
    // Given
    const steps = new RecordingRelaySteps();
    const useCase = createRelayUseCase(steps);
    const processingStaleBefore = NOW.subtract({ minutes: 15 }).toString({
      fractionalSecondDigits: 3,
    });

    // When
    await useCase.execute();

    // Then - 외부 전송 latency를 고려한 15분 lease만 복구한다. PUBLISHED generation은 시간 경과만으로 무효화하지 않는다
    expect(steps.steps).toEqual([
      `lifecycle-recover:${processingStaleBefore}`,
      `outbox-recover:${processingStaleBefore}`,
      "publish",
    ]);
    expect(steps.publishInputs).toEqual([{ kind: "available", limit: 100 }]);
  });

  it("항상 가득 찬 backlog도 trigger당 최대 10개 batch로 제한한다", async () => {
    // Given
    const steps = new RecordingRelaySteps();
    steps.publishedPerBatch = 100;
    const useCase = createRelayUseCase(steps);

    // When
    await useCase.execute();

    // Then - 한 worker가 queue를 독점하지 않도록 1,000개에서 양보
    expect(steps.publishInputs).toHaveLength(10);
  });
});
