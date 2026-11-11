import {
  type ClaimPushDeliveryOutboxInput,
  type DeferPushDeliveryPublicationsInput,
  PushDeliveryOutboxRepositoryPort,
} from "#api/modules/notification/push/application/ports/push-delivery-outbox.repository.port";
import type {
  ClaimedPushDeliveryPublication,
  PushDeliveryPublication,
} from "#api/modules/notification/push/application/read-models/push-delivery.read-model";
import type { PushDeliveryLane } from "#api/modules/notification/push/domain/push-delivery-lane.domain-service";

const PUSH_DELIVERY_OUTBOX_STATUSES = ["PENDING", "PROCESSING", "PUBLISHED"] as const;
type PushDeliveryOutboxStatus = (typeof PUSH_DELIVERY_OUTBOX_STATUSES)[number];

export interface InMemoryPushDeliveryOutboxRow {
  readonly dispatchId: number;
  readonly lane: PushDeliveryLane;
  readonly status: PushDeliveryOutboxStatus;
  readonly publishAttempts: number;
  readonly availableAt: Temporal.Instant;
  readonly lockedAt: Temporal.Instant | null;
  readonly lastError: string | null;
}

// Drizzle처럼 claim은 availableAt·dispatchId 순으로 PENDING만 가져가며 publishAttempts를 올린다(새 generation)
export class InMemoryPushDeliveryOutboxRepository extends PushDeliveryOutboxRepositoryPort {
  readonly #rows = new Map<number, InMemoryPushDeliveryOutboxRow>();
  markPublishedError: Error | null = null;

  constructor(rows: readonly InMemoryPushDeliveryOutboxRow[] = []) {
    super();
    for (const row of rows) {
      this.#rows.set(row.dispatchId, row);
    }
  }

  static pending(
    dispatchId: number,
    overrides: Partial<InMemoryPushDeliveryOutboxRow> = {},
  ): InMemoryPushDeliveryOutboxRow {
    return {
      dispatchId,
      lane: "TRANSACTIONAL",
      status: "PENDING",
      publishAttempts: 0,
      availableAt: Temporal.Instant.fromEpochMilliseconds(0),
      lockedAt: null,
      lastError: null,
      ...overrides,
    };
  }

  rowOf(dispatchId: number): InMemoryPushDeliveryOutboxRow | undefined {
    return this.#rows.get(dispatchId);
  }

  async claimByDispatchIds(
    dispatchIds: readonly number[],
    lockedAt: Temporal.Instant,
  ): Promise<readonly ClaimedPushDeliveryPublication[]> {
    return this.#claim(
      [...this.#rows.values()].filter((row) => dispatchIds.includes(row.dispatchId)),
      lockedAt,
      dispatchIds.length,
    );
  }

  async claimAvailable(
    input: ClaimPushDeliveryOutboxInput,
  ): Promise<readonly ClaimedPushDeliveryPublication[]> {
    return this.#claim([...this.#rows.values()], input.lockedAt, input.limit);
  }

  async markPublished(
    publications: readonly PushDeliveryPublication[],
    _publishedAt: Temporal.Instant,
  ): Promise<number> {
    if (this.markPublishedError != null) {
      throw this.markPublishedError;
    }
    return this.#transition(publications, (row) => ({
      ...row,
      status: "PUBLISHED",
      lockedAt: null,
      lastError: null,
    }));
  }

  async defer(input: DeferPushDeliveryPublicationsInput): Promise<number> {
    return this.#transition(input.publications, (row) => ({
      ...row,
      status: "PENDING",
      availableAt: input.availableAt,
      lockedAt: null,
      lastError: input.error.slice(0, 500),
    }));
  }

  async recoverStaleProcessing(lockedBefore: Temporal.Instant): Promise<number> {
    const stale = [...this.#rows.values()].filter(
      (row) =>
        row.status === "PROCESSING" &&
        row.lockedAt != null &&
        Temporal.Instant.compare(row.lockedAt, lockedBefore) < 0,
    );
    for (const row of stale) {
      this.#rows.set(row.dispatchId, { ...row, status: "PENDING", lockedAt: null });
    }
    return stale.length;
  }

  #claim(
    candidates: readonly InMemoryPushDeliveryOutboxRow[],
    lockedAt: Temporal.Instant,
    limit: number,
  ): ClaimedPushDeliveryPublication[] {
    const claimable = candidates
      .filter(
        (row) =>
          row.status === "PENDING" && Temporal.Instant.compare(row.availableAt, lockedAt) <= 0,
      )
      .toSorted(
        (left, right) =>
          Temporal.Instant.compare(left.availableAt, right.availableAt) ||
          left.dispatchId - right.dispatchId,
      )
      .slice(0, limit);
    return claimable.map((row) => {
      const claimed: InMemoryPushDeliveryOutboxRow = {
        ...row,
        status: "PROCESSING",
        lockedAt,
        publishAttempts: row.publishAttempts + 1,
        lastError: null,
      };
      this.#rows.set(row.dispatchId, claimed);
      return {
        dispatchId: claimed.dispatchId,
        publishAttempt: claimed.publishAttempts,
        lane: claimed.lane,
      };
    });
  }

  // 같은 generation(publishAttempt)이 아직 PROCESSING일 때만 바꾼다
  #transition(
    publications: readonly PushDeliveryPublication[],
    next: (row: InMemoryPushDeliveryOutboxRow) => InMemoryPushDeliveryOutboxRow,
  ): number {
    let count = 0;
    for (const publication of publications) {
      const row = this.#rows.get(publication.dispatchId);
      if (
        row != null &&
        row.status === "PROCESSING" &&
        row.publishAttempts === publication.publishAttempt
      ) {
        this.#rows.set(row.dispatchId, next(row));
        count += 1;
      }
    }
    return count;
  }
}
