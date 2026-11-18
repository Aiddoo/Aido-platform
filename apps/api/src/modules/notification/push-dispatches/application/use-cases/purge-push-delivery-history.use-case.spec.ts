import { MINUTE_MS } from "#api/shared/domain/time/time-units";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";

import type {
  DeleteFinishedPushDispatchesQuery,
  PushDeliveryHistoryRepositoryPort,
} from "../ports/push-delivery-history.repository.port.js";
import { PurgePushDeliveryHistoryUseCase } from "./purge-push-delivery-history.use-case.js";

const NOW = Temporal.Instant.from("2026-11-18T18:50:00Z");
const BATCH_SIZE = 3;
const FIRST_BATCH_LAST_SCHEDULED_AT = Temporal.Instant.from("2026-09-01T00:00:00Z");

interface ScriptedBatch {
  readonly deletedCount: number;
  readonly lastScheduledAt: Temporal.Instant | null;
}

// 정해 둔 묶음 결과를 차례로 돌려주고 받은 조건과 걸린 시간을 남긴다
class ScriptedPushDeliveryHistory implements PushDeliveryHistoryRepositoryPort {
  readonly dispatchQueries: DeleteFinishedPushDispatchesQuery[] = [];
  readonly #clock: FixedClock;
  readonly #reservationBatches: number[];
  readonly #dispatchBatches: ScriptedBatch[];
  readonly #elapsedPerStatementMs: number;

  constructor(options: {
    readonly clock: FixedClock;
    readonly reservationBatches: number[];
    readonly dispatchBatches: ScriptedBatch[];
    readonly elapsedPerStatementMs: number;
  }) {
    this.#clock = options.clock;
    this.#reservationBatches = options.reservationBatches;
    this.#dispatchBatches = options.dispatchBatches;
    this.#elapsedPerStatementMs = options.elapsedPerStatementMs;
  }

  async deleteRateLimitReservations(): Promise<number> {
    this.#clock.advanceBy({ milliseconds: this.#elapsedPerStatementMs });
    return this.#reservationBatches.shift() ?? 0;
  }

  async deleteFinishedDispatches(query: DeleteFinishedPushDispatchesQuery): Promise<ScriptedBatch> {
    this.dispatchQueries.push(query);
    this.#clock.advanceBy({ milliseconds: this.#elapsedPerStatementMs });
    return this.#dispatchBatches.shift() ?? { deletedCount: 0, lastScheduledAt: null };
  }
}

function setUp(options: {
  readonly reservationBatches?: number[];
  readonly dispatchBatches?: ScriptedBatch[];
  readonly elapsedPerStatementMs?: number;
}) {
  const clock = new FixedClock(NOW);
  const history = new ScriptedPushDeliveryHistory({
    clock,
    reservationBatches: options.reservationBatches ?? [],
    dispatchBatches: options.dispatchBatches ?? [],
    elapsedPerStatementMs: options.elapsedPerStatementMs ?? 0,
  });
  const useCase = new PurgePushDeliveryHistoryUseCase({
    history,
    clock,
    logger: new SilentLogger(),
  });
  const command = { deadline: NOW.add({ milliseconds: 2 * MINUTE_MS }), batchSize: BATCH_SIZE };
  return { useCase, history, command };
}

describe("PurgePushDeliveryHistoryUseCase — 발송 기록 보관 기간 정리", () => {
  it("묶음이 가득 차면 마지막으로 지운 예약 시각부터 이어 찾는다", async () => {
    // Given
    const { useCase, history, command } = setUp({
      dispatchBatches: [
        { deletedCount: BATCH_SIZE, lastScheduledAt: FIRST_BATCH_LAST_SCHEDULED_AT },
        { deletedCount: 1, lastScheduledAt: FIRST_BATCH_LAST_SCHEDULED_AT },
      ],
    });

    // When
    const result = await useCase.execute(command);

    // Then
    expect(result).toEqual({
      deletedReservations: 0,
      deletedDispatches: BATCH_SIZE + 1,
      completed: true,
    });
    expect(
      history.dispatchQueries
        .filter(({ status }) => status === "SENT")
        .map(({ scheduledFrom }) => scheduledFrom),
    ).toEqual([null, FIRST_BATCH_LAST_SCHEDULED_AT]);
  });

  it("2분 예산이 끝나면 남은 발송을 두고 completed false를 돌려준다", async () => {
    // Given
    const fullBatch = { deletedCount: BATCH_SIZE, lastScheduledAt: FIRST_BATCH_LAST_SCHEDULED_AT };
    const { useCase, command } = setUp({
      dispatchBatches: [fullBatch, fullBatch, fullBatch],
      elapsedPerStatementMs: MINUTE_MS,
    });

    // When
    const result = await useCase.execute(command);

    // Then
    expect(result.completed).toBe(false);
  });

  it("한도 예약 정리가 예산 안에 끝나지 않으면 발송은 찾지 않는다", async () => {
    // Given
    const { useCase, history, command } = setUp({
      reservationBatches: [BATCH_SIZE, BATCH_SIZE, BATCH_SIZE],
      elapsedPerStatementMs: MINUTE_MS,
    });

    // When
    const result = await useCase.execute(command);

    // Then
    expect(result).toEqual({
      deletedReservations: 2 * BATCH_SIZE,
      deletedDispatches: 0,
      completed: false,
    });
    expect(history.dispatchQueries).toEqual([]);
  });
});
