import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, exists, inArray, isNull, lt, or, type SQL, sql } from "drizzle-orm";
import { uniq } from "es-toolkit";
import { z } from "zod";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import {
  pushDeliveryAttempt,
  pushDispatch,
  pushDispatchOutbox,
  pushDispatchOutboxStatus,
  pushDispatchStatus,
  pushToken,
} from "#api/platform/database/schema/index";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import type {
  ClaimedPushDelivery,
  ClaimPushDeliveriesInput,
  FinalizePushDeliveryResultsInput,
  FinalizeSkippedPushDeliveryInput,
  PushDeliveryFence,
  PushDeliveryLifecycleRepositoryPort,
  ReleasePushDeliveryInput,
  ReopenPushDeliveriesAfterClaimFailureInput,
} from "../../application/ports/push-delivery-lifecycle.repository.port.js";
import type { PushDeliveryPublication } from "../../application/read-models/push-delivery.read-model.js";
import { toAttemptOutcome } from "./push-delivery-attempt.mapper.js";
import {
  matchesPublicationGeneration,
  type OutboxStatus,
} from "./push-outbox-generation.mapper.js";
import { pushTokenFingerprint } from "./push-token-fingerprint.mapper.js";

function toNotificationMetadata(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    return null;
  }
  return Object.fromEntries(Object.entries(value));
}

/** claim된 발행 세대는 처리 중이거나 이미 발행 표시된 상태다. */
const CLAIMED_OUTBOX_STATUSES: readonly OutboxStatus[] = ["PROCESSING", "PUBLISHED"];
const STALE_PROCESSING_LEASE_ERROR = "STALE_PROCESSING_LEASE";

const claimRowSchema = z.object({
  dispatchId: z.number().nullable(),
  deliveryAttemptCount: z.number().nullable(),
  publishAttempt: z.number().nullable(),
  ownedOutboxCount: z.number(),
});
const publicationRowsSchema = z.array(
  z.object({ dispatchId: z.number(), publishAttempt: z.number() }),
);
const releaseRowsSchema = z.array(
  z.object({ dispatchId: z.number(), publishAttempt: z.number(), reopenOutbox: z.boolean() }),
);

function excluded(column: { readonly name: string }) {
  return sql`excluded.${sql.identifier(column.name)}`;
}

// UPDATE의 SET 대상은 테이블 이름을 붙이지 않은 칼럼 이름이어야 한다
function setColumn(column: { readonly name: string }) {
  return sql.identifier(column.name);
}

function claimedOutboxStatus() {
  return inArray(pushDispatchOutbox.status, [...CLAIMED_OUTBOX_STATUSES]);
}

// 요청한 세대의 outbox 행을 claim과 같은 (availableAt, dispatchId) 순서로 잠그고 남은 요청만 넘긴다
function lockedRequests(columns: readonly string[], rows: readonly SQL[]): SQL {
  return sql`
    requested(${sql.join(
      columns.map((column) => sql.identifier(column)),
      sql`, `,
    )}) AS (
      VALUES ${sql.join([...rows], sql`, `)}
    ),
    locked_outboxes AS MATERIALIZED (
      SELECT requested.*
      FROM requested
      INNER JOIN ${pushDispatchOutbox}
        ON ${and(
          eq(pushDispatchOutbox.dispatchId, sql`requested."dispatchId"`),
          eq(pushDispatchOutbox.publishAttempts, sql`requested."publishAttempt"`),
          claimedOutboxStatus(),
        )}
      ORDER BY ${pushDispatchOutbox.availableAt} ASC, ${pushDispatchOutbox.dispatchId} ASC
      FOR UPDATE OF ${pushDispatchOutbox}
    )`;
}

// 요청한 job과 delivery attempt가 아직 lease를 쥔 dispatch만 바꾼다
function heldLease(): SQL | undefined {
  return and(
    eq(pushDispatch.id, sql`requested."dispatchId"`),
    eq(pushDispatch.status, "PROCESSING"),
    eq(pushDispatch.processingJobId, sql`requested."processingJobId"`),
    eq(pushDispatch.deliveryAttemptCount, sql`requested."deliveryAttemptCount"`),
  );
}

function fenceValues(fence: PushDeliveryFence): SQL {
  return sql`${fence.dispatchId}::INTEGER, ${fence.publishAttempt}::INTEGER, ${fence.processingJobId}::VARCHAR(255), ${fence.deliveryAttemptCount}::INTEGER`;
}

const FENCE_COLUMNS = [
  "dispatchId",
  "publishAttempt",
  "processingJobId",
  "deliveryAttemptCount",
] as const;

@Injectable()
export class DrizzlePushDeliveryLifecycleRepository implements PushDeliveryLifecycleRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #clock: ClockPort;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>, clock: ClockPort) {
    this.#txHost = txHost;
    this.#clock = clock;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async claim(input: ClaimPushDeliveriesInput): Promise<readonly ClaimedPushDelivery[]> {
    if (input.publications.length === 0) {
      return [];
    }
    await this.#lockClaimedGenerations(input.publications);
    const values = input.publications.map(
      (publication) =>
        sql`(${publication.dispatchId}::INTEGER, ${publication.publishAttempt}::INTEGER)`,
    );
    const startedAt = sql.param(input.startedAt, pushDispatch.processingStartedAt);
    // raw SQL: outbox 소유와 dispatch lease를 데이터 변경 CTE 두 개로 한 문장에서 옮겨 소유 수와 claim 수를 같은 스냅샷으로 맞춘다
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
    if (claimedRows.length === 0) {
      return [];
    }

    const claimByDispatchId = new Map(claimedRows.map((row) => [row.dispatchId, row]));
    const dispatches = await this.#db.query.pushDispatch.findMany({
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

    const claimedDeliveries = dispatches.flatMap((dispatch) => {
      const claim = claimByDispatchId.get(dispatch.id);
      if (
        !claim ||
        !dispatch.outbox ||
        dispatch.deliveryAttemptCount !== claim.deliveryAttemptCount
      ) {
        return [];
      }
      const notification = dispatch.notification;
      return [
        {
          fence: {
            dispatchId: dispatch.id,
            publishAttempt: claim.publishAttempt,
            processingJobId: input.processingJobId,
            deliveryAttemptCount: claim.deliveryAttemptCount,
          },
          deliveryMode: dispatch.outbox.deliveryMode,
          force: dispatch.outbox.force,
          rateLimitReservation: dispatch.rateLimitReservedAt
            ? { status: "reserved" as const }
            : { status: "pending" as const },
          item: {
            notificationId: dispatch.notificationId,
            data: {
              userId: notification.userId,
              type: notification.type,
              title: notification.title,
              body: notification.body,
              action: {
                type: notification.actionType,
                ...(notification.actionUrl ? { url: notification.actionUrl } : {}),
              },
              purpose: notification.purpose,
              campaignKey: notification.campaignKey,
              variantId: notification.variantId,
              todoId: notification.todoId,
              friendId: notification.friendId,
              nudgeId: notification.nudgeId,
              cheerId: notification.cheerId,
              metadata: toNotificationMetadata(notification.metadata),
              notificationDate: notification.notificationDate,
              force: dispatch.outbox.force,
            },
          },
        },
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

  async finalizeSkipped(inputs: readonly FinalizeSkippedPushDeliveryInput[]): Promise<number> {
    if (inputs.length === 0) {
      return 0;
    }
    const now = this.#clock.now();
    const values = inputs.map(
      (input) => sql`(
        ${fenceValues(input.fence)},
        ${input.context.timezone}::VARCHAR(50),
        ${input.context.localDate.toString()}::DATE,
        ${input.reason}::VARCHAR(100)
      )`,
    );
    // raw SQL: 행마다 다른 사유·시간대(VALUES CTE)를 FOR UPDATE OF로 잠근 outbox와 한 문장에서 이어 쓴다. query builder는 VALUES CTE를 만들지 못한다
    const finalized = publicationRowsSchema.parse(
      (
        await this.#db.execute<Record<string, unknown>>(sql`
          WITH ${lockedRequests([...FENCE_COLUMNS, "timezone", "localDate", "reason"], values)}
          UPDATE ${pushDispatch}
          SET
            ${setColumn(pushDispatch.status)} = ${"SKIPPED"}::${pushDispatchStatus},
            ${setColumn(pushDispatch.skipReason)} = requested."reason",
            ${setColumn(pushDispatch.timezone)} = requested."timezone",
            ${setColumn(pushDispatch.localDate)} = requested."localDate",
            ${setColumn(pushDispatch.processingJobId)} = NULL,
            ${setColumn(pushDispatch.processingJobAttempt)} = NULL,
            ${setColumn(pushDispatch.processingStartedAt)} = NULL,
            ${setColumn(pushDispatch.lastError)} = NULL,
            ${setColumn(pushDispatch.updatedAt)} = ${sql.param(now, pushDispatch.updatedAt)}
          FROM locked_outboxes AS requested
          WHERE ${heldLease()}
          RETURNING ${pushDispatch.id} AS "dispatchId", requested."publishAttempt"
        `)
      ).rows,
    );
    await this.#markOutboxesTerminal(finalized, now);
    return finalized.length;
  }

  async finalizeResults(inputs: readonly FinalizePushDeliveryResultsInput[]): Promise<number> {
    if (inputs.length === 0) {
      return 0;
    }
    const now = this.#clock.now();
    const allTokens = uniq(inputs.flatMap((input) => input.results.map((result) => result.token)));
    const tokens =
      allTokens.length === 0
        ? []
        : await this.#db
            .select({ id: pushToken.id, token: pushToken.token })
            .from(pushToken)
            .where(inArray(pushToken.token, allTokens));
    const tokenIdByValue = new Map(tokens.map((token) => [token.token, token.id]));
    const finalizationValues = inputs.map((input) => {
      const sent = input.results.some((result) => result.status === "accepted");
      const firstFailure = input.results.find((result) => result.status === "rejected");
      return sql`(
        ${fenceValues(input.fence)},
        ${input.context.timezone}::VARCHAR(50),
        ${input.context.localDate.toString()}::DATE,
        ${sent ? "SENT" : "FAILED"}::${pushDispatchStatus},
        ${sent || firstFailure?.status !== "rejected" ? null : firstFailure.failure.kind}::VARCHAR(500)
      )`;
    });
    // raw SQL: 행마다 다른 결과(VALUES CTE)를 FOR UPDATE OF로 잠근 outbox와 한 문장에서 이어 쓴다. query builder는 VALUES CTE를 만들지 못한다
    const finalized = publicationRowsSchema.parse(
      (
        await this.#db.execute<Record<string, unknown>>(sql`
          WITH ${lockedRequests(
            [...FENCE_COLUMNS, "timezone", "localDate", "nextStatus", "lastError"],
            finalizationValues,
          )}
          UPDATE ${pushDispatch}
          SET
            ${setColumn(pushDispatch.status)} = requested."nextStatus",
            ${setColumn(pushDispatch.sentAt)} = CASE
              WHEN requested."nextStatus" = ${"SENT"}::${pushDispatchStatus}
              THEN ${sql.param(now, pushDispatch.sentAt)}::TIMESTAMP(3)
              ELSE NULL
            END,
            ${setColumn(pushDispatch.timezone)} = requested."timezone",
            ${setColumn(pushDispatch.localDate)} = requested."localDate",
            ${setColumn(pushDispatch.processingJobId)} = NULL,
            ${setColumn(pushDispatch.processingJobAttempt)} = NULL,
            ${setColumn(pushDispatch.processingStartedAt)} = NULL,
            ${setColumn(pushDispatch.lastError)} = requested."lastError",
            ${setColumn(pushDispatch.updatedAt)} = ${sql.param(now, pushDispatch.updatedAt)}
          FROM locked_outboxes AS requested
          WHERE ${heldLease()}
          RETURNING ${pushDispatch.id} AS "dispatchId", requested."publishAttempt"
        `)
      ).rows,
    );
    const finalizedDispatchIds = new Set(finalized.map((item) => item.dispatchId));
    const attemptValues = inputs.flatMap((input) => {
      if (!finalizedDispatchIds.has(input.fence.dispatchId)) {
        return [];
      }
      return input.results.flatMap((result) => {
        const pushTokenId = tokenIdByValue.get(result.token);
        if (!pushTokenId) {
          return [];
        }
        return [
          {
            dispatchId: input.fence.dispatchId,
            pushTokenId,
            tokenFingerprint: pushTokenFingerprint(result.token),
            ...toAttemptOutcome(result),
            updatedAt: now,
          },
        ];
      });
    });
    if (attemptValues.length > 0) {
      await this.#db
        .insert(pushDeliveryAttempt)
        .values(attemptValues)
        .onConflictDoUpdate({
          target: [pushDeliveryAttempt.dispatchId, pushDeliveryAttempt.pushTokenId],
          set: {
            status: excluded(pushDeliveryAttempt.status),
            providerTicketId: excluded(pushDeliveryAttempt.providerTicketId),
            failureKind: excluded(pushDeliveryAttempt.failureKind),
            tokenFingerprint: excluded(pushDeliveryAttempt.tokenFingerprint),
            errorCode: excluded(pushDeliveryAttempt.errorCode),
            errorMessage: excluded(pushDeliveryAttempt.errorMessage),
            receiptCheckedAt: null,
            updatedAt: now,
          },
        });
    }

    await this.#markOutboxesTerminal(finalized, now);
    return finalized.length;
  }

  async release(inputs: readonly ReleasePushDeliveryInput[]): Promise<number> {
    if (inputs.length === 0) {
      return 0;
    }
    const now = this.#clock.now();
    const values = inputs.map(
      (input) => sql`(
        ${fenceValues(input.fence)},
        ${input.error.slice(0, 500)}::VARCHAR(500),
        ${input.reopenOutbox}::BOOLEAN
      )`,
    );
    // raw SQL: 행마다 다른 오류(VALUES CTE)를 FOR UPDATE OF로 잠근 outbox와 한 문장에서 이어 쓴다. query builder는 VALUES CTE를 만들지 못한다
    const released = releaseRowsSchema.parse(
      (
        await this.#db.execute<Record<string, unknown>>(sql`
          WITH ${lockedRequests([...FENCE_COLUMNS, "lastError", "reopenOutbox"], values)}
          UPDATE ${pushDispatch}
          SET
            ${setColumn(pushDispatch.status)} = ${"PENDING"}::${pushDispatchStatus},
            ${setColumn(pushDispatch.processingJobId)} = NULL,
            ${setColumn(pushDispatch.processingJobAttempt)} = NULL,
            ${setColumn(pushDispatch.processingStartedAt)} = NULL,
            ${setColumn(pushDispatch.lastError)} = requested."lastError",
            ${setColumn(pushDispatch.updatedAt)} = ${sql.param(now, pushDispatch.updatedAt)}
          FROM locked_outboxes AS requested
          WHERE ${heldLease()}
          RETURNING
            ${pushDispatch.id} AS "dispatchId",
            requested."publishAttempt",
            requested."reopenOutbox"
        `)
      ).rows,
    );
    const inputByDispatchId = new Map(inputs.map((input) => [input.fence.dispatchId, input]));
    const reopenValues = released.flatMap((item) => {
      const input = inputByDispatchId.get(item.dispatchId);
      if (!item.reopenOutbox || !input) {
        return [];
      }
      return [
        sql`(
          ${item.dispatchId}::INTEGER,
          ${item.publishAttempt}::INTEGER,
          ${sql.param(input.availableAt, pushDispatchOutbox.availableAt)}::TIMESTAMP(3),
          ${input.error.slice(0, 500)}::VARCHAR(500)
        )`,
      ];
    });
    if (reopenValues.length > 0) {
      // 마지막 attempt가 남긴 세대만 세대마다 다른 재시도 시각으로 다시 연다
      const reopened = await this.#db
        .update(pushDispatchOutbox)
        .set({
          status: "PENDING",
          availableAt: sql`reopened."availableAt"`,
          lockedAt: null,
          publishedAt: null,
          lastError: sql`reopened."lastError"`,
          updatedAt: now,
        })
        .from(
          sql`(VALUES ${sql.join(reopenValues, sql`, `)}) AS reopened("dispatchId", "publishAttempt", "availableAt", "lastError")`,
        )
        .where(
          and(
            eq(pushDispatchOutbox.dispatchId, sql`reopened."dispatchId"`),
            eq(pushDispatchOutbox.publishAttempts, sql`reopened."publishAttempt"`),
            claimedOutboxStatus(),
          ),
        )
        .returning({ dispatchId: pushDispatchOutbox.dispatchId });
      if (reopened.length !== reopenValues.length) {
        throw new Error(
          `Push delivery outbox reopen fence mismatch: expected=${reopenValues.length}, actual=${reopened.length}`,
        );
      }
    }
    return released.length;
  }

  async recoverStaleProcessing(startedBefore: Temporal.Instant): Promise<number> {
    const now = this.#clock.now();
    const staleLeases = this.#db
      .select({ dispatchId: pushDispatchOutbox.dispatchId })
      .from(pushDispatchOutbox)
      .innerJoin(pushDispatch, eq(pushDispatch.id, pushDispatchOutbox.dispatchId))
      .where(
        and(
          eq(pushDispatch.status, "PROCESSING"),
          lt(pushDispatch.processingStartedAt, startedBefore),
        ),
      )
      .orderBy(asc(pushDispatchOutbox.availableAt), asc(pushDispatchOutbox.dispatchId))
      .for("update", { of: pushDispatchOutbox, skipLocked: true });
    const recovered = await this.#db
      .update(pushDispatch)
      .set({
        status: "PENDING",
        processingJobId: null,
        processingJobAttempt: null,
        processingStartedAt: null,
        lastError: STALE_PROCESSING_LEASE_ERROR,
        updatedAt: now,
      })
      .where(
        and(
          inArray(pushDispatch.id, staleLeases),
          eq(pushDispatch.status, "PROCESSING"),
          lt(pushDispatch.processingStartedAt, startedBefore),
        ),
      )
      .returning({ dispatchId: pushDispatch.id });
    if (recovered.length === 0) {
      return 0;
    }
    const reopened = await this.#db
      .update(pushDispatchOutbox)
      .set({
        status: "PENDING",
        availableAt: now,
        lockedAt: null,
        publishedAt: null,
        lastError: STALE_PROCESSING_LEASE_ERROR,
        updatedAt: now,
      })
      .where(
        and(
          inArray(
            pushDispatchOutbox.dispatchId,
            recovered.map(({ dispatchId }) => dispatchId),
          ),
          claimedOutboxStatus(),
        ),
      )
      .returning({ dispatchId: pushDispatchOutbox.dispatchId });
    return reopened.length;
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
  async #lockClaimedGenerations(publications: readonly PushDeliveryPublication[]): Promise<void> {
    await this.#db
      .select({ dispatchId: pushDispatchOutbox.dispatchId })
      .from(pushDispatchOutbox)
      .where(and(matchesPublicationGeneration(publications), claimedOutboxStatus()))
      .orderBy(asc(pushDispatchOutbox.availableAt), asc(pushDispatchOutbox.dispatchId))
      .for("update");
  }

  async #markOutboxesTerminal(
    publications: readonly PushDeliveryPublication[],
    now: Temporal.Instant,
  ): Promise<void> {
    if (publications.length === 0) {
      return;
    }
    const terminal = await this.#db
      .update(pushDispatchOutbox)
      .set({
        status: "PUBLISHED",
        lockedAt: null,
        publishedAt: sql`COALESCE(${pushDispatchOutbox.publishedAt}, ${sql.param(now, pushDispatchOutbox.publishedAt)})`,
        lastError: null,
        updatedAt: now,
      })
      .where(and(matchesPublicationGeneration(publications), claimedOutboxStatus()))
      .returning({ dispatchId: pushDispatchOutbox.dispatchId });
    if (terminal.length !== publications.length) {
      throw new Error(
        `Push delivery terminal outbox fence mismatch: expected=${publications.length}, actual=${terminal.length}`,
      );
    }
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
}
