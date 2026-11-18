import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { PUSH_CHANNELS } from "../../../shared/domain/push-channel.constants.js";
import type { PushChannelRegistryPort } from "../ports/push-channel-registry.port.js";
import type { PushDeliveryLeaseRepositoryPort } from "../ports/push-delivery-lease.repository.port.js";
import { type PushDeliveryOutboxRepositoryPort } from "../ports/push-delivery-outbox.repository.port.js";
import { PUSH_DELIVERY_JOB_EXPIRE_SECONDS } from "../read-models/push-delivery.read-model.js";
import type { PublishPushDeliveryOutboxUseCase } from "./publish-push-delivery-outbox.use-case.js";

const RELAY_BATCH_SIZE = 100;
const MAX_BATCHES_PER_TRIGGER = 10;

// lease가 작업 만료보다 짧으면 실행 중인 작업을 되돌려 두 번 보내고, 공급자 전송은 만료 뒤에도 이어질 수 있어
// 한 배치가 여러 채널로 갈 수 있으므로 가장 긴 채널의 여유를 더한다
function processingLeaseMs(channels: Pick<PushChannelRegistryPort, "forChannel">): number {
  const sendGraceMs = Math.max(
    ...PUSH_CHANNELS.map((channel) => channels.forChannel(channel).timing.unabortableSendGraceMs),
  );
  return PUSH_DELIVERY_JOB_EXPIRE_SECONDS * 1000 + sendGraceMs;
}

interface RelayPushDeliveryOutboxDependencies {
  readonly outbox: Pick<PushDeliveryOutboxRepositoryPort, "recoverStaleProcessing">;
  readonly lease: Pick<PushDeliveryLeaseRepositoryPort, "recoverStaleProcessing">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly publishOutbox: Pick<PublishPushDeliveryOutboxUseCase, "execute">;
  readonly channels: Pick<PushChannelRegistryPort, "forChannel">;
  readonly clock: ClockPort;
}

export class RelayPushDeliveryOutboxUseCase {
  readonly #dependencies: RelayPushDeliveryOutboxDependencies;

  constructor(dependencies: RelayPushDeliveryOutboxDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<void> {
    const processingCutoff = this.#dependencies.clock
      .now()
      .subtract({ milliseconds: processingLeaseMs(this.#dependencies.channels) });
    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.lease.recoverStaleProcessing(processingCutoff);
      await this.#dependencies.outbox.recoverStaleProcessing(processingCutoff);
    });

    for (let batch = 0; batch < MAX_BATCHES_PER_TRIGGER; batch += 1) {
      const published = await this.#dependencies.publishOutbox.execute({
        kind: "available",
        limit: RELAY_BATCH_SIZE,
      });
      if (published < RELAY_BATCH_SIZE) {
        return;
      }
    }
  }
}
