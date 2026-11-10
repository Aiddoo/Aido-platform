import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, inArray, sql } from "drizzle-orm";
import { uniq } from "es-toolkit";
import { z } from "zod";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import {
  pushDeliveryAttempt,
  pushDispatch,
  pushDispatchOutbox,
  pushToken,
} from "#api/platform/database/schema/index";

import type {
  ClaimedPushDelivery,
  ClaimPushDeliveriesInput,
  FinalizePushDeliveryResultsInput,
  FinalizeSkippedPushDeliveryInput,
  PushDeliveryLifecycleRepositoryPort,
  ReleasePushDeliveryInput,
  ReopenPushDeliveriesAfterClaimFailureInput,
  ReservePushDeliveryRateLimitInput,
} from "../../application/ports/push-delivery-lifecycle.repository.port.js";
import type { PushDeliveryPublication } from "../../application/read-models/push-delivery.read-model.js";
import { toAttemptOutcome } from "./push-delivery-attempt.mapper.js";
import {
  lockPublicationGenerations,
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

const claimRowSchema = z.object({
  dispatchId: z.number().nullable(),
  deliveryAttemptCount: z.number().nullable(),
  publishAttempt: z.number().nullable(),
  ownedOutboxCount: z.number(),
});
const dispatchRowsSchema = z.array(z.object({ dispatchId: z.number() }));
const publicationRowsSchema = z.array(
  z.object({ dispatchId: z.number(), publishAttempt: z.number() }),
);
const releaseRowsSchema = z.array(
  z.object({ dispatchId: z.number(), publishAttempt: z.number(), reopenOutbox: z.boolean() }),
);

function excluded(column: { readonly name: string }) {
  return sql`excluded.${sql.identifier(column.name)}`;
}

@Injectable()
export class DrizzlePushDeliveryLifecycleRepository implements PushDeliveryLifecycleRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async claim(input: ClaimPushDeliveriesInput): Promise<readonly ClaimedPushDelivery[]> {
    if (input.publications.length === 0) {
      return [];
    }
    await lockPublicationGenerations(this.#db, input.publications, CLAIMED_OUTBOX_STATUSES);
    const values = input.publications.map(
      (publication) =>
        sql`(${publication.dispatchId}::INTEGER, ${publication.publishAttempt}::INTEGER)`,
    );
    const ownershipRows = z.array(claimRowSchema).parse(
      (
        await this.#db.execute<Record<string, unknown>>(sql`
			WITH requested("dispatchId", "publishAttempt") AS (
				VALUES ${sql.join(values, sql`, `)}
			),
			locked_outboxes AS MATERIALIZED (
				UPDATE ${pushDispatchOutbox} AS outbox
				SET
					"status" = 'PUBLISHED'::"PushDispatchOutboxStatus",
					"lockedAt" = NULL,
					"publishedAt" = COALESCE(outbox."publishedAt", CURRENT_TIMESTAMP),
					"lastError" = NULL,
					"updatedAt" = CURRENT_TIMESTAMP
				FROM requested
				WHERE outbox."dispatchId" = requested."dispatchId"
					AND outbox."publishAttempts" = requested."publishAttempt"
					AND outbox."status" IN (
						'PROCESSING'::"PushDispatchOutboxStatus",
						'PUBLISHED'::"PushDispatchOutboxStatus"
					)
					AND EXISTS (
						SELECT 1
						FROM ${pushDispatch} AS dispatch
						WHERE dispatch."id" = requested."dispatchId"
							AND (
								dispatch."status" = 'PENDING'::"PushDispatchStatus"
								OR (
									dispatch."status" = 'PROCESSING'::"PushDispatchStatus"
									AND dispatch."processingJobId" = ${input.processingJobId}
									AND COALESCE(dispatch."processingJobAttempt", 0) < ${input.processingJobAttempt}
								)
							)
					)
				RETURNING outbox."dispatchId", outbox."publishAttempts" AS "publishAttempt"
			),
			claimed_dispatches AS MATERIALIZED (
				UPDATE ${pushDispatch} AS dispatch
				SET
					"status" = 'PROCESSING'::"PushDispatchStatus",
					"processingJobId" = ${input.processingJobId},
					"processingJobAttempt" = ${input.processingJobAttempt},
					"processingStartedAt" = ${sql.param(input.startedAt, pushDispatch.processingStartedAt)},
					"deliveryAttemptCount" = dispatch."deliveryAttemptCount" + 1,
					"skipReason" = NULL,
					"lastError" = NULL,
					"updatedAt" = CURRENT_TIMESTAMP
				FROM locked_outboxes AS outbox
				WHERE dispatch."id" = outbox."dispatchId"
					AND (
						dispatch."status" = 'PENDING'::"PushDispatchStatus"
						OR (
							dispatch."status" = 'PROCESSING'::"PushDispatchStatus"
							AND dispatch."processingJobId" = ${input.processingJobId}
							AND COALESCE(dispatch."processingJobAttempt", 0) < ${input.processingJobAttempt}
						)
					)
				RETURNING
					dispatch."id" AS "dispatchId",
					dispatch."deliveryAttemptCount",
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
    inputs: readonly ReservePushDeliveryRateLimitInput[],
  ): Promise<readonly number[]> {
    if (inputs.length === 0) {
      return [];
    }
    const values = inputs.map(
      (input) => sql`(
				${input.fence.dispatchId}::INTEGER,
				${input.fence.processingJobId}::VARCHAR(255),
				${input.fence.deliveryAttemptCount}::INTEGER,
				${sql.param(input.reservedAt, pushDispatch.rateLimitReservedAt)}::TIMESTAMP(3)
			)`,
    );
    const reserved = dispatchRowsSchema.parse(
      (
        await this.#db.execute<Record<string, unknown>>(sql`
			UPDATE ${pushDispatch} AS dispatch
			SET
				"rateLimitReservedAt" = requested."reservedAt",
				"updatedAt" = CURRENT_TIMESTAMP
			FROM (VALUES ${sql.join(values, sql`, `)}) AS requested(
				"dispatchId",
				"processingJobId",
				"deliveryAttemptCount",
				"reservedAt"
			)
			WHERE dispatch."id" = requested."dispatchId"
				AND dispatch."status" = 'PROCESSING'::"PushDispatchStatus"
				AND dispatch."processingJobId" = requested."processingJobId"
				AND dispatch."deliveryAttemptCount" = requested."deliveryAttemptCount"
				AND dispatch."rateLimitReservedAt" IS NULL
			RETURNING dispatch."id" AS "dispatchId"
		`)
      ).rows,
    );
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
    const values = inputs.map(
      (input) => sql`(
				${input.fence.dispatchId}::INTEGER,
				${input.fence.publishAttempt}::INTEGER,
				${input.fence.processingJobId}::VARCHAR(255),
				${input.fence.deliveryAttemptCount}::INTEGER,
				${input.context.timezone}::VARCHAR(50),
				${input.context.localDate.toString()}::DATE,
				${input.reason}::VARCHAR(100)
			)`,
    );
    const finalized = publicationRowsSchema.parse(
      (
        await this.#db.execute<Record<string, unknown>>(sql`
			WITH requested(
				"dispatchId",
				"publishAttempt",
				"processingJobId",
				"deliveryAttemptCount",
				"timezone",
				"localDate",
				"reason"
			) AS (
				VALUES ${sql.join(values, sql`, `)}
			),
			locked_outboxes AS MATERIALIZED (
				SELECT requested.*
				FROM requested
				INNER JOIN ${pushDispatchOutbox} AS outbox
					ON outbox."dispatchId" = requested."dispatchId"
					AND outbox."publishAttempts" = requested."publishAttempt"
					AND outbox."status" IN (
						'PROCESSING'::"PushDispatchOutboxStatus",
						'PUBLISHED'::"PushDispatchOutboxStatus"
					)
					ORDER BY outbox."availableAt" ASC, outbox."dispatchId" ASC
				FOR UPDATE OF outbox
			)
			UPDATE ${pushDispatch} AS dispatch
			SET
				"status" = 'SKIPPED'::"PushDispatchStatus",
				"skipReason" = requested."reason",
				"timezone" = requested."timezone",
				"localDate" = requested."localDate",
				"processingJobId" = NULL,
				"processingJobAttempt" = NULL,
				"processingStartedAt" = NULL,
				"lastError" = NULL,
				"updatedAt" = CURRENT_TIMESTAMP
			FROM locked_outboxes AS requested
			WHERE dispatch."id" = requested."dispatchId"
				AND dispatch."status" = 'PROCESSING'::"PushDispatchStatus"
				AND dispatch."processingJobId" = requested."processingJobId"
				AND dispatch."deliveryAttemptCount" = requested."deliveryAttemptCount"
			RETURNING dispatch."id" AS "dispatchId", requested."publishAttempt"
		`)
      ).rows,
    );
    await this.#markOutboxesTerminal(finalized);
    return finalized.length;
  }

  async finalizeResults(inputs: readonly FinalizePushDeliveryResultsInput[]): Promise<number> {
    if (inputs.length === 0) {
      return 0;
    }
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
				${input.fence.dispatchId}::INTEGER,
				${input.fence.publishAttempt}::INTEGER,
				${input.fence.processingJobId}::VARCHAR(255),
				${input.fence.deliveryAttemptCount}::INTEGER,
				${input.context.timezone}::VARCHAR(50),
				${input.context.localDate.toString()}::DATE,
				${sent ? "SENT" : "FAILED"}::"PushDispatchStatus",
				${sent || firstFailure?.status !== "rejected" ? null : firstFailure.failure.kind}::VARCHAR(500)
			)`;
    });
    const finalized = publicationRowsSchema.parse(
      (
        await this.#db.execute<Record<string, unknown>>(sql`
			WITH requested(
				"dispatchId",
				"publishAttempt",
				"processingJobId",
				"deliveryAttemptCount",
				"timezone",
				"localDate",
				"nextStatus",
				"lastError"
			) AS (
				VALUES ${sql.join(finalizationValues, sql`, `)}
			),
			locked_outboxes AS MATERIALIZED (
				SELECT requested.*
				FROM requested
				INNER JOIN ${pushDispatchOutbox} AS outbox
					ON outbox."dispatchId" = requested."dispatchId"
					AND outbox."publishAttempts" = requested."publishAttempt"
					AND outbox."status" IN (
						'PROCESSING'::"PushDispatchOutboxStatus",
						'PUBLISHED'::"PushDispatchOutboxStatus"
					)
					ORDER BY outbox."availableAt" ASC, outbox."dispatchId" ASC
				FOR UPDATE OF outbox
			)
			UPDATE ${pushDispatch} AS dispatch
			SET
				"status" = requested."nextStatus",
				"sentAt" = CASE
					WHEN requested."nextStatus" = 'SENT'::"PushDispatchStatus"
					THEN CURRENT_TIMESTAMP
					ELSE NULL
				END,
				"timezone" = requested."timezone",
				"localDate" = requested."localDate",
				"processingJobId" = NULL,
				"processingJobAttempt" = NULL,
				"processingStartedAt" = NULL,
				"lastError" = requested."lastError",
				"updatedAt" = CURRENT_TIMESTAMP
			FROM locked_outboxes AS requested
			WHERE dispatch."id" = requested."dispatchId"
				AND dispatch."status" = 'PROCESSING'::"PushDispatchStatus"
				AND dispatch."processingJobId" = requested."processingJobId"
				AND dispatch."deliveryAttemptCount" = requested."deliveryAttemptCount"
			RETURNING dispatch."id" AS "dispatchId", requested."publishAttempt"
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
            updatedAt: sql`CURRENT_TIMESTAMP`,
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
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        });
    }

    await this.#markOutboxesTerminal(finalized);
    return finalized.length;
  }

  async release(inputs: readonly ReleasePushDeliveryInput[]): Promise<number> {
    if (inputs.length === 0) {
      return 0;
    }
    const values = inputs.map(
      (input) => sql`(
				${input.fence.dispatchId}::INTEGER,
				${input.fence.publishAttempt}::INTEGER,
				${input.fence.processingJobId}::VARCHAR(255),
				${input.fence.deliveryAttemptCount}::INTEGER,
				${input.error.slice(0, 500)}::VARCHAR(500),
				${input.reopenOutbox}::BOOLEAN,
				${sql.param(input.availableAt, pushDispatchOutbox.availableAt)}::TIMESTAMP(3)
			)`,
    );
    const released = releaseRowsSchema.parse(
      (
        await this.#db.execute<Record<string, unknown>>(sql`
			WITH requested(
				"dispatchId",
				"publishAttempt",
				"processingJobId",
				"deliveryAttemptCount",
				"lastError",
				"reopenOutbox",
				"availableAt"
			) AS (
				VALUES ${sql.join(values, sql`, `)}
			),
			locked_outboxes AS MATERIALIZED (
				SELECT requested.*
				FROM requested
				INNER JOIN ${pushDispatchOutbox} AS outbox
					ON outbox."dispatchId" = requested."dispatchId"
					AND outbox."publishAttempts" = requested."publishAttempt"
					AND outbox."status" IN (
						'PROCESSING'::"PushDispatchOutboxStatus",
						'PUBLISHED'::"PushDispatchOutboxStatus"
					)
					ORDER BY outbox."availableAt" ASC, outbox."dispatchId" ASC
				FOR UPDATE OF outbox
			)
			UPDATE ${pushDispatch} AS dispatch
			SET
				"status" = 'PENDING'::"PushDispatchStatus",
				"processingJobId" = NULL,
				"processingJobAttempt" = NULL,
				"processingStartedAt" = NULL,
				"lastError" = requested."lastError",
				"updatedAt" = CURRENT_TIMESTAMP
			FROM locked_outboxes AS requested
			WHERE dispatch."id" = requested."dispatchId"
				AND dispatch."status" = 'PROCESSING'::"PushDispatchStatus"
				AND dispatch."processingJobId" = requested."processingJobId"
				AND dispatch."deliveryAttemptCount" = requested."deliveryAttemptCount"
			RETURNING
				dispatch."id" AS "dispatchId",
				requested."publishAttempt",
				requested."reopenOutbox"
		`)
      ).rows,
    );
    const inputByDispatchId = new Map(inputs.map((input) => [input.fence.dispatchId, input]));
    const reopen = released.filter((item) => item.reopenOutbox);
    if (reopen.length > 0) {
      const reopenValues = reopen.flatMap((item) => {
        const input = inputByDispatchId.get(item.dispatchId);
        if (!input) {
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
      const reopened =
        (await (
          await this.#db.execute<Record<string, unknown>>(sql`
				UPDATE ${pushDispatchOutbox} AS outbox
				SET
					"status" = 'PENDING'::"PushDispatchOutboxStatus",
					"availableAt" = requested."availableAt",
					"lockedAt" = NULL,
					"publishedAt" = NULL,
					"lastError" = requested."lastError",
					"updatedAt" = CURRENT_TIMESTAMP
				FROM (VALUES ${sql.join(reopenValues, sql`, `)}) AS requested(
					"dispatchId", "publishAttempt", "availableAt", "lastError"
				)
				WHERE outbox."dispatchId" = requested."dispatchId"
					AND outbox."publishAttempts" = requested."publishAttempt"
					AND outbox."status" IN (
						'PROCESSING'::"PushDispatchOutboxStatus",
						'PUBLISHED'::"PushDispatchOutboxStatus"
					)
			`)
        ).rowCount) ?? 0;
      if (reopened !== reopen.length) {
        throw new Error(
          `Push delivery outbox reopen fence mismatch: expected=${reopen.length}, actual=${reopened}`,
        );
      }
    }
    return released.length;
  }

  async recoverStaleProcessing(startedBefore: Temporal.Instant): Promise<number> {
    return (
      (
        await this.#db.execute<Record<string, unknown>>(sql`
			WITH locked_outboxes AS MATERIALIZED (
				SELECT outbox."dispatchId"
				FROM ${pushDispatchOutbox} AS outbox
				INNER JOIN ${pushDispatch} AS dispatch
					ON dispatch."id" = outbox."dispatchId"
				WHERE dispatch."status" = 'PROCESSING'::"PushDispatchStatus"
					AND dispatch."processingStartedAt" < ${sql.param(startedBefore, pushDispatch.processingStartedAt)}
					ORDER BY outbox."availableAt" ASC, outbox."dispatchId" ASC
				FOR UPDATE OF outbox SKIP LOCKED
			),
			recovered AS (
				UPDATE ${pushDispatch} AS dispatch
				SET
					"status" = 'PENDING'::"PushDispatchStatus",
					"processingJobId" = NULL,
					"processingJobAttempt" = NULL,
					"processingStartedAt" = NULL,
					"lastError" = 'STALE_PROCESSING_LEASE',
					"updatedAt" = CURRENT_TIMESTAMP
				FROM locked_outboxes
				WHERE dispatch."id" = locked_outboxes."dispatchId"
					AND dispatch."status" = 'PROCESSING'::"PushDispatchStatus"
					AND dispatch."processingStartedAt" < ${sql.param(startedBefore, pushDispatch.processingStartedAt)}
				RETURNING dispatch."id"
			)
			UPDATE ${pushDispatchOutbox} AS outbox
			SET
				"status" = 'PENDING'::"PushDispatchOutboxStatus",
				"availableAt" = CURRENT_TIMESTAMP,
				"lockedAt" = NULL,
				"publishedAt" = NULL,
				"lastError" = 'STALE_PROCESSING_LEASE',
				"updatedAt" = CURRENT_TIMESTAMP
			FROM recovered
			WHERE outbox."dispatchId" = recovered."id"
				AND outbox."status" IN (
					'PROCESSING'::"PushDispatchOutboxStatus",
					'PUBLISHED'::"PushDispatchOutboxStatus"
				)
		`)
      ).rowCount ?? 0
    );
  }

  async #markOutboxesTerminal(publications: readonly PushDeliveryPublication[]): Promise<void> {
    if (publications.length === 0) {
      return;
    }
    const values = publications.map(
      (publication) =>
        sql`(${publication.dispatchId}::INTEGER, ${publication.publishAttempt}::INTEGER)`,
    );
    const terminal =
      (await (
        await this.#db.execute<Record<string, unknown>>(sql`
			UPDATE ${pushDispatchOutbox} AS outbox
			SET
				"status" = 'PUBLISHED'::"PushDispatchOutboxStatus",
				"lockedAt" = NULL,
				"publishedAt" = COALESCE(outbox."publishedAt", CURRENT_TIMESTAMP),
				"lastError" = NULL,
				"updatedAt" = CURRENT_TIMESTAMP
			FROM (VALUES ${sql.join(values, sql`, `)}) AS terminal("dispatchId", "publishAttempt")
			WHERE outbox."dispatchId" = terminal."dispatchId"
				AND outbox."publishAttempts" = terminal."publishAttempt"
				AND outbox."status" IN (
					'PROCESSING'::"PushDispatchOutboxStatus",
					'PUBLISHED'::"PushDispatchOutboxStatus"
				)
		`)
      ).rowCount) ?? 0;
    if (terminal !== publications.length) {
      throw new Error(
        `Push delivery terminal outbox fence mismatch: expected=${publications.length}, actual=${terminal}`,
      );
    }
  }

  async #reopenUnclaimedPublications(
    input: ReopenPushDeliveriesAfterClaimFailureInput,
  ): Promise<number> {
    if (input.publications.length === 0) {
      return 0;
    }
    await lockPublicationGenerations(this.#db, input.publications, CLAIMED_OUTBOX_STATUSES);
    // dispatch가 아직 PENDING인 세대만 다시 연다. 이미 claim된 dispatch의 outbox를 되돌리지 않는다.
    const reopened = await this.#db
      .update(pushDispatchOutbox)
      .set({
        status: "PENDING",
        availableAt: input.availableAt,
        lockedAt: null,
        publishedAt: null,
        lastError: input.error.slice(0, 500),
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        and(
          matchesPublicationGeneration(input.publications),
          inArray(pushDispatchOutbox.status, [...CLAIMED_OUTBOX_STATUSES]),
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
