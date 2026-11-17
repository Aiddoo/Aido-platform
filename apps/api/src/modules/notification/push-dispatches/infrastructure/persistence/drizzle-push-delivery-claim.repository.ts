import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, exists, inArray, isNull, lt, or, type SQL, sql } from "drizzle-orm";
import { z } from "zod";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import {
  pushDispatch,
  pushDispatchOutbox,
  pushDispatchOutboxStatus,
  pushDispatchStatus,
} from "#api/platform/database/schema/index";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import type {
  ClaimedPushDelivery,
  ClaimPushDeliveriesInput,
  PushDeliveryClaimRepositoryPort,
  PushDeliveryFence,
  ReopenPushDeliveriesAfterClaimFailureInput,
} from "../../application/ports/push-delivery-claim.repository.port.js";
import type { PushDeliveryPublicationReadModel } from "../../application/read-models/push-delivery.read-model.js";
import { type ClaimedRow, toClaimedPushDelivery } from "./claimed-push-delivery.mapper.js";
import { claimedOutboxStatus, setColumn } from "./push-delivery-lifecycle.query-fragment.js";
import { matchesPublicationGeneration } from "./push-outbox-generation.mapper.js";

const claimRowSchema = z.object({
  dispatchId: z.number().nullable(),
  deliveryAttemptCount: z.number().nullable(),
  publishAttempt: z.number().nullable(),
  ownedOutboxCount: z.number(),
});

@Injectable()
export class DrizzlePushDeliveryClaimRepository implements PushDeliveryClaimRepositoryPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #clock: ClockPort;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>, clock: ClockPort) {
    this.#transactionHost = transactionHost;
    this.#clock = clock;
  }

  async claim(input: ClaimPushDeliveriesInput): Promise<readonly ClaimedPushDelivery[]> {
    if (input.publications.length === 0) {
      return [];
    }
    const claimedRows = await this.#takeOwnership(input);
    if (claimedRows.length === 0) {
      return [];
    }
    const dispatches = await this.#loadClaimedDispatches(input, claimedRows);
    const claimByDispatchId = new Map(claimedRows.map((row) => [row.dispatchId, row]));
    const claimedDeliveries = dispatches.flatMap((dispatch) => {
      const claim = claimByDispatchId.get(dispatch.id);
      if (
        !claim ||
        !dispatch.outbox ||
        dispatch.deliveryAttemptCount !== claim.deliveryAttemptCount
      ) {
        return [];
      }
      return [
        toClaimedPushDelivery({
          dispatch,
          outbox: dispatch.outbox,
          claim,
          processingJobId: input.processingJobId,
        }),
      ];
    });
    if (claimedDeliveries.length !== claimedRows.length) {
      throw new Error(
        `Push delivery claim hydration fence mismatch: claimed=${claimedRows.length}, hydrated=${claimedDeliveries.length}`,
      );
    }
    return claimedDeliveries;
  }

  async markRateLimitReserved(
    fences: readonly PushDeliveryFence[],
    reservedAt: Temporal.Instant,
  ): Promise<readonly number[]> {
    if (fences.length === 0) {
      return [];
    }
    const reserved = await this.#db
      .update(pushDispatch)
      .set({ rateLimitReservedAt: reservedAt, updatedAt: reservedAt })
      .where(
        and(
          or(
            ...fences.map((fence) =>
              and(
                eq(pushDispatch.id, fence.dispatchId),
                eq(pushDispatch.processingJobId, fence.processingJobId),
                eq(pushDispatch.deliveryAttemptCount, fence.deliveryAttemptCount),
              ),
            ),
          ),
          eq(pushDispatch.status, "PROCESSING"),
          isNull(pushDispatch.rateLimitReservedAt),
        ),
      )
      .returning({ dispatchId: pushDispatch.id });
    return reserved.map((item) => item.dispatchId);
  }

  reopenAfterFinalClaimFailure(input: ReopenPushDeliveriesAfterClaimFailureInput): Promise<number> {
    return this.#reopenUnclaimedPublications(input);
  }

  reopenFailedPublications(input: ReopenPushDeliveriesAfterClaimFailureInput): Promise<number> {
    return this.#reopenUnclaimedPublications(input);
  }

  // raw SQL: outbox 소유와 dispatch lease를 데이터 변경 CTE 두 개로 한 문장에서 옮겨 소유 수와 claim 수를 같은 스냅샷으로 맞춘다
  async #takeOwnership(input: ClaimPushDeliveriesInput): Promise<readonly ClaimedRow[]> {
    await this.#lockClaimedGenerations(input.publications);
    const values = input.publications.map(
      (publication) =>
        sql`(${publication.dispatchId}::INTEGER, ${publication.publishAttempt}::INTEGER)`,
    );
    const startedAt = sql.param(input.startedAt, pushDispatch.processingStartedAt);
    const ownershipRows = z.array(claimRowSchema).parse(
      (
        await this.#db.execute<Record<string, unknown>>(sql`
          WITH requested("dispatchId", "publishAttempt") AS (
            VALUES ${sql.join(values, sql`, `)}
          ),
          locked_outboxes AS MATERIALIZED (
            UPDATE ${pushDispatchOutbox}
            SET
              ${setColumn(pushDispatchOutbox.status)} = ${"PUBLISHED"}::${pushDispatchOutboxStatus},
              ${setColumn(pushDispatchOutbox.lockedAt)} = NULL,
              ${setColumn(pushDispatchOutbox.publishedAt)} = COALESCE(${pushDispatchOutbox.publishedAt}, ${startedAt}),
              ${setColumn(pushDispatchOutbox.lastError)} = NULL,
              ${setColumn(pushDispatchOutbox.updatedAt)} = ${startedAt}
            FROM requested
            WHERE ${and(
              eq(pushDispatchOutbox.dispatchId, sql`requested."dispatchId"`),
              eq(pushDispatchOutbox.publishAttempts, sql`requested."publishAttempt"`),
              claimedOutboxStatus(),
              exists(
                this.#db
                  .select({ one: sql`1` })
                  .from(pushDispatch)
                  .where(
                    and(eq(pushDispatch.id, sql`requested."dispatchId"`), this.#claimableBy(input)),
                  ),
              ),
            )}
            RETURNING ${pushDispatchOutbox.dispatchId}, ${pushDispatchOutbox.publishAttempts} AS "publishAttempt"
          ),
          claimed_dispatches AS MATERIALIZED (
            UPDATE ${pushDispatch}
            SET
              ${setColumn(pushDispatch.status)} = ${"PROCESSING"}::${pushDispatchStatus},
              ${setColumn(pushDispatch.processingJobId)} = ${input.processingJobId},
              ${setColumn(pushDispatch.processingJobAttempt)} = ${input.processingJobAttempt},
              ${setColumn(pushDispatch.processingStartedAt)} = ${startedAt},
              ${setColumn(pushDispatch.deliveryAttemptCount)} = ${pushDispatch.deliveryAttemptCount} + 1,
              ${setColumn(pushDispatch.skipReason)} = NULL,
              ${setColumn(pushDispatch.lastError)} = NULL,
              ${setColumn(pushDispatch.updatedAt)} = ${startedAt}
            FROM locked_outboxes AS outbox
            WHERE ${and(eq(pushDispatch.id, sql`outbox."dispatchId"`), this.#claimableBy(input))}
            RETURNING
              ${pushDispatch.id} AS "dispatchId",
              ${pushDispatch.deliveryAttemptCount},
              outbox."publishAttempt"
          ),
          ownership AS (
            SELECT COUNT(*)::INTEGER AS "ownedOutboxCount"
            FROM locked_outboxes
          )
          SELECT
            claimed."dispatchId",
            claimed."deliveryAttemptCount",
            claimed."publishAttempt",
            ownership."ownedOutboxCount"
          FROM claimed_dispatches AS claimed
          CROSS JOIN ownership
          UNION ALL
          SELECT NULL, NULL, NULL, ownership."ownedOutboxCount"
          FROM ownership
          WHERE ownership."ownedOutboxCount" > 0
            AND NOT EXISTS (SELECT 1 FROM claimed_dispatches)
        `)
      ).rows,
    );
    const ownedOutboxCount = ownershipRows[0]?.ownedOutboxCount ?? 0;
    const claimedRows = ownershipRows.flatMap((row) => {
      if (
        row.dispatchId == null ||
        row.deliveryAttemptCount == null ||
        row.publishAttempt == null
      ) {
        return [];
      }
      return [
        {
          dispatchId: row.dispatchId,
          deliveryAttemptCount: row.deliveryAttemptCount,
          publishAttempt: row.publishAttempt,
        },
      ];
    });
    if (claimedRows.length !== ownedOutboxCount) {
      throw new Error(
        `Push delivery claim ownership fence mismatch: owned=${ownedOutboxCount}, claimed=${claimedRows.length}`,
      );
    }
    return claimedRows;
  }

  async #loadClaimedDispatches(
    input: ClaimPushDeliveriesInput,
    claimedRows: readonly ClaimedRow[],
  ) {
    return this.#db.query.pushDispatch.findMany({
      columns: {
        id: true,
        notificationId: true,
        deliveryAttemptCount: true,
        rateLimitReservedAt: true,
        timezone: true,
        localDate: true,
      },
      where: {
        AND: [
          {
            OR: claimedRows.map((claim) => ({
              id: claim.dispatchId,
              deliveryAttemptCount: claim.deliveryAttemptCount,
            })),
          },
          { processingJobId: input.processingJobId, status: "PROCESSING" },
        ],
      },
      with: {
        outbox: { columns: { deliveryMode: true, force: true } },
        notification: {
          columns: {
            userId: true,
            type: true,
            title: true,
            body: true,
            actionType: true,
            actionUrl: true,
            purpose: true,
            campaignKey: true,
            variantId: true,
            todoId: true,
            friendId: true,
            nudgeId: true,
            cheerId: true,
            metadata: true,
            notificationDate: true,
          },
        },
      },
      orderBy: { id: "asc" },
    });
  }

  // 새 dispatch이거나 같은 runtime job의 더 높은 attempt가 이어 받는 lease다
  #claimableBy(input: ClaimPushDeliveriesInput): SQL | undefined {
    return or(
      eq(pushDispatch.status, "PENDING"),
      and(
        eq(pushDispatch.status, "PROCESSING"),
        eq(pushDispatch.processingJobId, input.processingJobId),
        lt(sql`COALESCE(${pushDispatch.processingJobAttempt}, 0)`, input.processingJobAttempt),
      ),
    );
  }

  /** claim과 같은 (availableAt, dispatchId) 순서로 잠가 동시 정리 사이의 deadlock을 막는다. */
  async #lockClaimedGenerations(
    publications: readonly PushDeliveryPublicationReadModel[],
  ): Promise<void> {
    await this.#db
      .select({ dispatchId: pushDispatchOutbox.dispatchId })
      .from(pushDispatchOutbox)
      .where(and(matchesPublicationGeneration(publications), claimedOutboxStatus()))
      .orderBy(asc(pushDispatchOutbox.availableAt), asc(pushDispatchOutbox.dispatchId))
      .for("update");
  }

  async #reopenUnclaimedPublications(
    input: ReopenPushDeliveriesAfterClaimFailureInput,
  ): Promise<number> {
    if (input.publications.length === 0) {
      return 0;
    }
    await this.#lockClaimedGenerations(input.publications);
    // dispatch가 아직 PENDING인 세대만 다시 연다. 이미 claim된 dispatch의 outbox를 되돌리지 않는다.
    const reopened = await this.#db
      .update(pushDispatchOutbox)
      .set({
        status: "PENDING",
        availableAt: input.availableAt,
        lockedAt: null,
        publishedAt: null,
        lastError: input.error.slice(0, 500),
        updatedAt: this.#clock.now(),
      })
      .where(
        and(
          matchesPublicationGeneration(input.publications),
          claimedOutboxStatus(),
          inArray(
            pushDispatchOutbox.dispatchId,
            this.#db
              .select({ id: pushDispatch.id })
              .from(pushDispatch)
              .where(eq(pushDispatch.status, "PENDING")),
          ),
        ),
      )
      .returning({ dispatchId: pushDispatchOutbox.dispatchId });
    return reopened.length;
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
