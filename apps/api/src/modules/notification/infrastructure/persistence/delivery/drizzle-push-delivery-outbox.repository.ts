import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, lte, type SQL, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { pushDispatch, pushDispatchOutbox } from "#api/platform/database/schema/index";

import type {
  ClaimPushDeliveryOutboxInput,
  DeferPushDeliveryPublicationsInput,
  PushDeliveryOutboxRepositoryPort,
} from "../../../application/ports/delivery/push-delivery-outbox.repository.port.js";
import type { PushDeliveryPublication } from "../../../application/types/delivery/push-delivery.types.js";
import {
  lockPublicationGenerations,
  matchesPublicationGeneration,
} from "./push-outbox-generation.js";

const candidate = alias(pushDispatchOutbox, "candidate");

@Injectable()
export class DrizzlePushDeliveryOutboxRepository implements PushDeliveryOutboxRepositoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  claimByDispatchIds(
    dispatchIds: readonly number[],
    lockedAt: Date,
  ): Promise<readonly PushDeliveryPublication[]> {
    if (dispatchIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.#claim({
      limit: dispatchIds.length,
      lockedAt,
      dispatchFilter: inArray(candidate.dispatchId, [...dispatchIds]),
    });
  }

  claimAvailable(input: ClaimPushDeliveryOutboxInput): Promise<readonly PushDeliveryPublication[]> {
    if (input.limit <= 0) {
      return Promise.resolve([]);
    }
    return this.#claim({ limit: input.limit, lockedAt: input.lockedAt });
  }

  async markPublished(
    publications: readonly PushDeliveryPublication[],
    publishedAt: Date,
  ): Promise<number> {
    if (publications.length === 0) {
      return 0;
    }
    await lockPublicationGenerations(this.db, publications, ["PROCESSING"]);
    const updated = await this.db
      .update(pushDispatchOutbox)
      .set({ status: "PUBLISHED", lockedAt: null, publishedAt, lastError: null })
      .where(this.processingGenerations(publications))
      .returning({ dispatchId: pushDispatchOutbox.dispatchId });
    return updated.length;
  }

  async defer(input: DeferPushDeliveryPublicationsInput): Promise<number> {
    if (input.publications.length === 0) {
      return 0;
    }
    await lockPublicationGenerations(this.db, input.publications, ["PROCESSING"]);
    const updated = await this.db
      .update(pushDispatchOutbox)
      .set({
        status: "PENDING",
        availableAt: input.availableAt,
        lockedAt: null,
        publishedAt: null,
        lastError: input.error.slice(0, 500),
      })
      .where(this.processingGenerations(input.publications))
      .returning({ dispatchId: pushDispatchOutbox.dispatchId });
    return updated.length;
  }

  /** 발행 세대와 PROCESSING 상태를 UPDATE 술어에 남겨 다른 worker가 재claim한 행을 덮어쓰지 않는다. */
  private processingGenerations(publications: readonly PushDeliveryPublication[]) {
    return and(
      matchesPublicationGeneration(publications),
      eq(pushDispatchOutbox.status, "PROCESSING"),
    );
  }

  async recoverStaleProcessing(lockedBefore: Date): Promise<number> {
    const result = await this.db.execute<Record<string, unknown>>(sql`
      WITH locked_outboxes AS MATERIALIZED (
        SELECT
          outbox."dispatchId",
          dispatch."status" AS "dispatchStatus"
        FROM ${pushDispatchOutbox} AS outbox
        INNER JOIN ${pushDispatch} AS dispatch
          ON dispatch."id" = outbox."dispatchId"
        WHERE outbox."status" = 'PROCESSING'::"PushDispatchOutboxStatus"
          AND outbox."lockedAt" < ${lockedBefore.toISOString()}
          AND dispatch."status" <> 'PROCESSING'::"PushDispatchStatus"
        ORDER BY outbox."availableAt" ASC, outbox."dispatchId" ASC
        FOR UPDATE OF outbox SKIP LOCKED
      )
      UPDATE ${pushDispatchOutbox} AS outbox
      SET
        "status" = CASE
          WHEN locked_outboxes."dispatchStatus" IN (
            'SENT'::"PushDispatchStatus",
            'SKIPPED'::"PushDispatchStatus",
            'FAILED'::"PushDispatchStatus",
            'HOLDOUT'::"PushDispatchStatus"
          ) THEN 'PUBLISHED'::"PushDispatchOutboxStatus"
          ELSE 'PENDING'::"PushDispatchOutboxStatus"
        END,
        "lockedAt" = NULL,
        "publishedAt" = CASE
          WHEN locked_outboxes."dispatchStatus" IN (
            'SENT'::"PushDispatchStatus",
            'SKIPPED'::"PushDispatchStatus",
            'FAILED'::"PushDispatchStatus",
            'HOLDOUT'::"PushDispatchStatus"
          ) THEN COALESCE(outbox."publishedAt", CURRENT_TIMESTAMP)
          ELSE NULL
        END,
        "updatedAt" = CURRENT_TIMESTAMP
      FROM locked_outboxes
      WHERE outbox."dispatchId" = locked_outboxes."dispatchId"
        AND outbox."status" = 'PROCESSING'::"PushDispatchOutboxStatus"
    `);
    return result.rowCount ?? 0;
  }

  async #claim(input: {
    readonly limit: number;
    readonly lockedAt: Date;
    readonly dispatchFilter?: SQL;
  }): Promise<readonly PushDeliveryPublication[]> {
    const candidates = this.db
      .select({ dispatchId: candidate.dispatchId })
      .from(candidate)
      .where(
        and(
          eq(candidate.status, "PENDING"),
          lte(candidate.availableAt, sql`CURRENT_TIMESTAMP`),
          input.dispatchFilter,
        ),
      )
      .orderBy(asc(candidate.availableAt), asc(candidate.dispatchId))
      .limit(input.limit)
      .for("update", { skipLocked: true });

    return this.db
      .update(pushDispatchOutbox)
      .set({
        status: "PROCESSING",
        lockedAt: input.lockedAt,
        publishedAt: null,
        publishAttempts: sql`${pushDispatchOutbox.publishAttempts} + 1`,
        lastError: null,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(inArray(pushDispatchOutbox.dispatchId, candidates))
      .returning({
        dispatchId: pushDispatchOutbox.dispatchId,
        publishAttempt: pushDispatchOutbox.publishAttempts,
      });
  }
}
