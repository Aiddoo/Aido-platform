import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, lt, lte, type SQL, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import {
  notification,
  pushDispatch,
  pushDispatchOutbox,
} from "#api/platform/database/schema/index";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import type {
  ClaimPushDeliveryOutboxInput,
  DeferPushDeliveryPublicationsInput,
  PushDeliveryOutboxRepositoryPort,
} from "../../application/ports/push-delivery-outbox.repository.port.js";
import type {
  ClaimedPushDeliveryPublication,
  PushDeliveryPublication,
} from "../../application/read-models/push-delivery.read-model.js";
import { pushDeliveryLaneOf } from "../../domain/push-delivery-lane.domain-service.js";
import type { PushDispatchStatus } from "../../domain/push-delivery-status.constants.js";
import { matchesPublicationGeneration } from "./push-outbox-generation.mapper.js";

const candidate = alias(pushDispatchOutbox, "candidate");
// 끝난 dispatch의 outbox는 발행 표시로 닫고, 아직 보내지 않은 dispatch의 outbox는 다시 연다
const FINISHED_DISPATCH_STATUSES: readonly PushDispatchStatus[] = [
  "SENT",
  "SKIPPED",
  "FAILED",
  "HOLDOUT",
];

@Injectable()
export class DrizzlePushDeliveryOutboxRepository implements PushDeliveryOutboxRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #clock: ClockPort;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>, clock: ClockPort) {
    this.#txHost = txHost;
    this.#clock = clock;
  }

  get #db() {
    return this.#txHost.tx;
  }

  claimByDispatchIds(
    dispatchIds: readonly number[],
    lockedAt: Temporal.Instant,
  ): Promise<readonly ClaimedPushDeliveryPublication[]> {
    if (dispatchIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.#claim({
      limit: dispatchIds.length,
      lockedAt,
      dispatchFilter: inArray(candidate.dispatchId, [...dispatchIds]),
    });
  }

  claimAvailable(
    input: ClaimPushDeliveryOutboxInput,
  ): Promise<readonly ClaimedPushDeliveryPublication[]> {
    if (input.limit <= 0) {
      return Promise.resolve([]);
    }
    return this.#claim({ limit: input.limit, lockedAt: input.lockedAt });
  }

  async markPublished(
    publications: readonly PushDeliveryPublication[],
    publishedAt: Temporal.Instant,
  ): Promise<number> {
    if (publications.length === 0) {
      return 0;
    }
    await this.#lockProcessingGenerations(publications);
    const updated = await this.#db
      .update(pushDispatchOutbox)
      .set({
        status: "PUBLISHED",
        lockedAt: null,
        publishedAt,
        lastError: null,
        updatedAt: publishedAt,
      })
      .where(this.#processingGenerations(publications))
      .returning({ dispatchId: pushDispatchOutbox.dispatchId });
    return updated.length;
  }

  async defer(input: DeferPushDeliveryPublicationsInput): Promise<number> {
    if (input.publications.length === 0) {
      return 0;
    }
    await this.#lockProcessingGenerations(input.publications);
    const updated = await this.#db
      .update(pushDispatchOutbox)
      .set({
        status: "PENDING",
        availableAt: input.availableAt,
        lockedAt: null,
        publishedAt: null,
        lastError: input.error.slice(0, 500),
        updatedAt: this.#clock.now(),
      })
      .where(this.#processingGenerations(input.publications))
      .returning({ dispatchId: pushDispatchOutbox.dispatchId });
    return updated.length;
  }

  /** claim과 같은 (availableAt, dispatchId) 순서로 잠가 동시 정리 사이의 deadlock을 막는다. */
  async #lockProcessingGenerations(
    publications: readonly PushDeliveryPublication[],
  ): Promise<void> {
    await this.#db
      .select({ dispatchId: pushDispatchOutbox.dispatchId })
      .from(pushDispatchOutbox)
      .where(this.#processingGenerations(publications))
      .orderBy(asc(pushDispatchOutbox.availableAt), asc(pushDispatchOutbox.dispatchId))
      .for("update");
  }

  /** 발행 세대와 PROCESSING 상태를 UPDATE 술어에 남겨 다른 worker가 재claim한 행을 덮어쓰지 않는다. */
  #processingGenerations(publications: readonly PushDeliveryPublication[]) {
    return and(
      matchesPublicationGeneration(publications),
      eq(pushDispatchOutbox.status, "PROCESSING"),
    );
  }

  async recoverStaleProcessing(lockedBefore: Temporal.Instant): Promise<number> {
    const now = this.#clock.now();
    const published = await this.#db
      .update(pushDispatchOutbox)
      .set({
        status: "PUBLISHED",
        lockedAt: null,
        publishedAt: sql`COALESCE(${pushDispatchOutbox.publishedAt}, ${sql.param(now, pushDispatchOutbox.publishedAt)})`,
        updatedAt: now,
      })
      .where(
        and(
          inArray(
            pushDispatchOutbox.dispatchId,
            this.#staleProcessing(lockedBefore, FINISHED_DISPATCH_STATUSES),
          ),
          eq(pushDispatchOutbox.status, "PROCESSING"),
        ),
      )
      .returning({ dispatchId: pushDispatchOutbox.dispatchId });
    const reopened = await this.#db
      .update(pushDispatchOutbox)
      .set({ status: "PENDING", lockedAt: null, publishedAt: null, updatedAt: now })
      .where(
        and(
          inArray(pushDispatchOutbox.dispatchId, this.#staleProcessing(lockedBefore, ["PENDING"])),
          eq(pushDispatchOutbox.status, "PROCESSING"),
        ),
      )
      .returning({ dispatchId: pushDispatchOutbox.dispatchId });
    return published.length + reopened.length;
  }

  // 발행 표시 전에 멈춘 outbox lease. 실행 중인 delivery(dispatch PROCESSING)와 다른 worker가 잡은 행은 건너뛴다
  #staleProcessing(
    lockedBefore: Temporal.Instant,
    dispatchStatuses: readonly PushDispatchStatus[],
  ) {
    return this.#db
      .select({ dispatchId: pushDispatchOutbox.dispatchId })
      .from(pushDispatchOutbox)
      .innerJoin(pushDispatch, eq(pushDispatch.id, pushDispatchOutbox.dispatchId))
      .where(
        and(
          eq(pushDispatchOutbox.status, "PROCESSING"),
          lt(pushDispatchOutbox.lockedAt, lockedBefore),
          inArray(pushDispatch.status, [...dispatchStatuses]),
        ),
      )
      .orderBy(asc(pushDispatchOutbox.availableAt), asc(pushDispatchOutbox.dispatchId))
      .for("update", { of: pushDispatchOutbox, skipLocked: true });
  }

  async #claim(input: {
    readonly limit: number;
    readonly lockedAt: Temporal.Instant;
    readonly dispatchFilter?: SQL;
  }): Promise<readonly ClaimedPushDeliveryPublication[]> {
    const candidates = this.#db
      .select({ dispatchId: candidate.dispatchId })
      .from(candidate)
      .where(
        and(
          eq(candidate.status, "PENDING"),
          // 칸이 timestamp(3)이라 기본값 now()가 ms로 반올림돼 저장된다. 같은 정밀도로 비교해야 방금 stage한 행을 건너뛰지 않는다
          lte(candidate.availableAt, sql`LOCALTIMESTAMP(3)`),
          input.dispatchFilter,
        ),
      )
      .orderBy(asc(candidate.availableAt), asc(candidate.dispatchId))
      .limit(input.limit)
      .for("update", { skipLocked: true });

    const claimed = await this.#db
      .update(pushDispatchOutbox)
      .set({
        status: "PROCESSING",
        lockedAt: input.lockedAt,
        publishedAt: null,
        publishAttempts: sql`${pushDispatchOutbox.publishAttempts} + 1`,
        lastError: null,
        updatedAt: input.lockedAt,
      })
      .where(inArray(pushDispatchOutbox.dispatchId, candidates))
      .returning({
        dispatchId: pushDispatchOutbox.dispatchId,
        publishAttempt: pushDispatchOutbox.publishAttempts,
      });
    return this.#withLanes(claimed);
  }

  async #withLanes(
    publications: readonly PushDeliveryPublication[],
  ): Promise<readonly ClaimedPushDeliveryPublication[]> {
    if (publications.length === 0) {
      return [];
    }
    const sources = await this.#db
      .select({
        dispatchId: pushDispatch.id,
        purpose: pushDispatch.purpose,
        type: notification.type,
      })
      .from(pushDispatch)
      .innerJoin(notification, eq(notification.id, pushDispatch.notificationId))
      .where(
        inArray(
          pushDispatch.id,
          publications.map(({ dispatchId }) => dispatchId),
        ),
      );
    const sourceByDispatchId = new Map(sources.map((source) => [source.dispatchId, source]));
    return publications.map((publication) => {
      const source = sourceByDispatchId.get(publication.dispatchId);
      // outbox 행을 잡은 같은 트랜잭션이라 dispatch가 사라질 수 없다. 그래도 없으면 늦지 않게 거래성으로 보낸다
      return {
        ...publication,
        lane: source == null ? "TRANSACTIONAL" : pushDeliveryLaneOf(source),
      };
    });
  }
}
