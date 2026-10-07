import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, or } from "@prisma/orm-postgres/orm-client";
import sql, { join } from "sql-template-tag";

import { decodeRecord } from "#api/platform/database/database-records";
import { decodeSqlRows, sqlRowSpec, sqlStatement } from "#api/platform/database/database-sql";
import { varchar } from "#api/platform/database/database-values";
import { requireRecord } from "#api/platform/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";

import type {
  ClaimedPushDelivery,
  ClaimPushDeliveriesInput,
  FinalizePushDeliveryResultsInput,
  FinalizeSkippedPushDeliveryInput,
  PushDeliveryLifecycleRepositoryPort,
  ReleasePushDeliveryInput,
  ReopenPushDeliveriesAfterClaimFailureInput,
  ReservePushDeliveryRateLimitInput,
} from "../../../application/ports/delivery/push-delivery-lifecycle.repository.port.js";
import type { PushDeliveryPublication } from "../../../application/types/delivery/push-delivery.types.js";

function toNotificationMetadata(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value));
}

@Injectable()
export class PrismaPushDeliveryLifecycleRepository implements PushDeliveryLifecycleRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  private get client() {
    return this.txHost.tx;
  }

  async claim(input: ClaimPushDeliveriesInput): Promise<readonly ClaimedPushDelivery[]> {
    const sqlRows1 = sqlRowSpec({
      dispatchId: { codecId: "pg/int4@1", nullable: true },
      deliveryAttemptCount: { codecId: "pg/int4@1", nullable: true },
      publishAttempt: { codecId: "pg/int4@1", nullable: true },
      ownedOutboxCount: "pg/int4@1",
    });

    if (input.publications.length === 0) return [];
    await this.#lockOutboxGenerations(input.publications);
    const values = input.publications.map(
      (publication) =>
        sql`(${publication.dispatchId}::INTEGER, ${publication.publishAttempt}::INTEGER)`,
    );
    const ownershipRows = decodeSqlRows(
      sqlRows1,
      await this.client.query(
        sqlStatement(
          this.client,
          sql`
			WITH requested("dispatchId", "publishAttempt") AS (
				VALUES ${join(values)}
			),
			locked_outboxes AS MATERIALIZED (
				UPDATE "PushDispatchOutbox" AS outbox
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
						FROM "PushDispatch" AS dispatch
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
				UPDATE "PushDispatch" AS dispatch
				SET
					"status" = 'PROCESSING'::"PushDispatchStatus",
					"processingJobId" = ${input.processingJobId},
					"processingJobAttempt" = ${input.processingJobAttempt},
					"processingStartedAt" = ${input.startedAt},
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
		`,
        )
          .returnsRow(sqlRows1)
          .build(),
      ),
    );
    const ownedOutboxCount = ownershipRows[0]?.ownedOutboxCount ?? 0;
    const claimedRows = ownershipRows.flatMap((row) => {
      if (
        row.dispatchId === null ||
        row.deliveryAttemptCount === null ||
        row.publishAttempt === null
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
    if (claimedRows.length === 0) return [];

    const claimByDispatchId = new Map(claimedRows.map((row) => [row.dispatchId, row]));
    const dispatches = decodeRecord(
      "PushDispatch",
      await this.client.orm.public.PushDispatch.where((row) =>
        or(
          ...claimedRows.map((claim) =>
            and(
              row.id.eq(claim.dispatchId),
              row.deliveryAttemptCount.eq(claim.deliveryAttemptCount),
            ),
          ),
        ),
      )
        .where((row) =>
          and(
            row.processingJobId.eq(varchar(input.processingJobId, 255)),
            row.status.eq("PROCESSING"),
          ),
        )
        .select(
          "id",
          "notificationId",
          "deliveryAttemptCount",
          "rateLimitReservedAt",
          "timezone",
          "localDate",
        )
        .include("outbox", (related) => related.select("deliveryMode", "force"))
        .include("notification", (related) =>
          related.select(
            "userId",
            "_type",
            "title",
            "body",
            "actionType",
            "actionUrl",
            "purpose",
            "campaignKey",
            "variantId",
            "todoId",
            "friendId",
            "nudgeId",
            "cheerId",
            "metadata",
            "notificationDate",
          ),
        )
        .orderBy((row) => row.id.asc())
        .all(),
    );

    const claimedDeliveries = dispatches.flatMap((dispatch) => {
      const claim = claimByDispatchId.get(dispatch.id);
      if (
        !claim ||
        !dispatch.outbox ||
        dispatch.deliveryAttemptCount !== claim.deliveryAttemptCount
      ) {
        return [];
      }
      const notification = requireRecord(dispatch.notification);
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
    const sqlRows2 = sqlRowSpec({ dispatchId: "pg/int4@1" });

    if (inputs.length === 0) return [];
    const values = inputs.map(
      (input) => sql`(
				${input.fence.dispatchId}::INTEGER,
				${input.fence.processingJobId}::VARCHAR(255),
				${input.fence.deliveryAttemptCount}::INTEGER,
				${input.reservedAt}::TIMESTAMP(3)
			)`,
    );
    const reserved = decodeSqlRows(
      sqlRows2,
      await this.client.query(
        sqlStatement(
          this.client,
          sql`
			UPDATE "PushDispatch" AS dispatch
			SET
				"rateLimitReservedAt" = requested."reservedAt",
				"updatedAt" = CURRENT_TIMESTAMP
			FROM (VALUES ${join(values)}) AS requested(
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
		`,
        )
          .returnsRow(sqlRows2)
          .build(),
      ),
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
    const sqlRows3 = sqlRowSpec({ dispatchId: "pg/int4@1", publishAttempt: "pg/int4@1" });

    if (inputs.length === 0) return 0;
    const values = inputs.map(
      (input) => sql`(
				${input.fence.dispatchId}::INTEGER,
				${input.fence.publishAttempt}::INTEGER,
				${input.fence.processingJobId}::VARCHAR(255),
				${input.fence.deliveryAttemptCount}::INTEGER,
				${input.context.timezone}::VARCHAR(50),
				${input.context.localDate}::DATE,
				${input.reason}::VARCHAR(100)
			)`,
    );
    const finalized = decodeSqlRows(
      sqlRows3,
      await this.client.query(
        sqlStatement(
          this.client,
          sql`
			WITH requested(
				"dispatchId",
				"publishAttempt",
				"processingJobId",
				"deliveryAttemptCount",
				"timezone",
				"localDate",
				"reason"
			) AS (
				VALUES ${join(values)}
			),
			locked_outboxes AS MATERIALIZED (
				SELECT requested.*
				FROM requested
				INNER JOIN "PushDispatchOutbox" AS outbox
					ON outbox."dispatchId" = requested."dispatchId"
					AND outbox."publishAttempts" = requested."publishAttempt"
					AND outbox."status" IN (
						'PROCESSING'::"PushDispatchOutboxStatus",
						'PUBLISHED'::"PushDispatchOutboxStatus"
					)
					ORDER BY outbox."availableAt" ASC, outbox."dispatchId" ASC
				FOR UPDATE OF outbox
			)
			UPDATE "PushDispatch" AS dispatch
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
		`,
        )
          .returnsRow(sqlRows3)
          .build(),
      ),
    );
    await this.#markOutboxesTerminal(finalized);
    return finalized.length;
  }

  async finalizeResults(inputs: readonly FinalizePushDeliveryResultsInput[]): Promise<number> {
    const sqlRows4 = sqlRowSpec({ dispatchId: "pg/int4@1", publishAttempt: "pg/int4@1" });

    if (inputs.length === 0) return 0;
    const allTokens = [
      ...new Set(inputs.flatMap((input) => input.results.map((result) => result.token))),
    ];
    const tokens =
      allTokens.length === 0
        ? []
        : decodeRecord(
            "PushToken",
            await this.client.orm.public.PushToken.where((row) =>
              row.token.in(allTokens.map((value) => varchar(value, 255))),
            )
              .select("id", "token")
              .all(),
          );
    const tokenIdByValue = new Map(tokens.map((token) => [token.token, token.id]));
    const finalizationValues = inputs.map((input) => {
      const sent = input.results.some((result) => result.success);
      const firstError = input.results.find((result) => !result.success)?.error;
      return sql`(
				${input.fence.dispatchId}::INTEGER,
				${input.fence.publishAttempt}::INTEGER,
				${input.fence.processingJobId}::VARCHAR(255),
				${input.fence.deliveryAttemptCount}::INTEGER,
				${input.context.timezone}::VARCHAR(50),
				${input.context.localDate}::DATE,
				${sent ? "SENT" : "FAILED"}::"PushDispatchStatus",
				${sent ? null : (firstError?.slice(0, 500) ?? null)}::VARCHAR(500)
			)`;
    });
    const finalized = decodeSqlRows(
      sqlRows4,
      await this.client.query(
        sqlStatement(
          this.client,
          sql`
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
				VALUES ${join(finalizationValues)}
			),
			locked_outboxes AS MATERIALIZED (
				SELECT requested.*
				FROM requested
				INNER JOIN "PushDispatchOutbox" AS outbox
					ON outbox."dispatchId" = requested."dispatchId"
					AND outbox."publishAttempts" = requested."publishAttempt"
					AND outbox."status" IN (
						'PROCESSING'::"PushDispatchOutboxStatus",
						'PUBLISHED'::"PushDispatchOutboxStatus"
					)
					ORDER BY outbox."availableAt" ASC, outbox."dispatchId" ASC
				FOR UPDATE OF outbox
			)
			UPDATE "PushDispatch" AS dispatch
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
		`,
        )
          .returnsRow(sqlRows4)
          .build(),
      ),
    );
    const finalizedDispatchIds = new Set(finalized.map((item) => item.dispatchId));
    const attemptValues = inputs.flatMap((input) => {
      if (!finalizedDispatchIds.has(input.fence.dispatchId)) return [];
      return input.results.flatMap((result) => {
        const pushTokenId = tokenIdByValue.get(result.token);
        if (!pushTokenId) return [];
        return [
          sql`(
						${input.fence.dispatchId}::INTEGER,
						${pushTokenId}::INTEGER,
						${result.success ? "TICKET_ACCEPTED" : "FAILED"}::"PushDeliveryStatus",
						${result.ticketId ?? null},
						${result.errorCode ?? null},
						${result.error?.slice(0, 500) ?? null},
						CURRENT_TIMESTAMP
					)`,
        ];
      });
    });
    if (attemptValues.length > 0) {
      await this.client
        .execute(
          sqlStatement(
            this.client,
            sql`
				INSERT INTO "PushDeliveryAttempt" (
					"dispatchId",
					"pushTokenId",
					"status",
					"expoTicketId",
					"errorCode",
					"errorMessage",
					"updatedAt"
				)
				VALUES ${join(attemptValues)}
				ON CONFLICT ("dispatchId", "pushTokenId")
				DO UPDATE SET
					"status" = EXCLUDED."status",
					"expoTicketId" = EXCLUDED."expoTicketId",
					"errorCode" = EXCLUDED."errorCode",
					"errorMessage" = EXCLUDED."errorMessage",
					"receiptCheckedAt" = NULL,
					"updatedAt" = CURRENT_TIMESTAMP
			`,
          )
            .affectedCount()
            .build(),
        )
        .then((result) => result.affectedRows);
    }

    await this.#markOutboxesTerminal(finalized);
    return finalized.length;
  }

  async release(inputs: readonly ReleasePushDeliveryInput[]): Promise<number> {
    const sqlRows5 = sqlRowSpec({
      reopenOutbox: "pg/bool@1",
      availableAt: "pg/timestamp-string@1",
      lastError: "pg/text@1",
      dispatchId: "pg/int4@1",
      publishAttempt: "pg/int4@1",
    });

    if (inputs.length === 0) return 0;
    const values = inputs.map(
      (input) => sql`(
				${input.fence.dispatchId}::INTEGER,
				${input.fence.publishAttempt}::INTEGER,
				${input.fence.processingJobId}::VARCHAR(255),
				${input.fence.deliveryAttemptCount}::INTEGER,
				${input.error.slice(0, 500)}::VARCHAR(500),
				${input.reopenOutbox}::BOOLEAN,
				${input.availableAt}::TIMESTAMP(3)
			)`,
    );
    const released = decodeSqlRows(
      sqlRows5,
      await this.client.query(
        sqlStatement(
          this.client,
          sql`
			WITH requested(
				"dispatchId",
				"publishAttempt",
				"processingJobId",
				"deliveryAttemptCount",
				"lastError",
				"reopenOutbox",
				"availableAt"
			) AS (
				VALUES ${join(values)}
			),
			locked_outboxes AS MATERIALIZED (
				SELECT requested.*
				FROM requested
				INNER JOIN "PushDispatchOutbox" AS outbox
					ON outbox."dispatchId" = requested."dispatchId"
					AND outbox."publishAttempts" = requested."publishAttempt"
					AND outbox."status" IN (
						'PROCESSING'::"PushDispatchOutboxStatus",
						'PUBLISHED'::"PushDispatchOutboxStatus"
					)
					ORDER BY outbox."availableAt" ASC, outbox."dispatchId" ASC
				FOR UPDATE OF outbox
			)
			UPDATE "PushDispatch" AS dispatch
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
				requested."reopenOutbox",
				requested."availableAt",
				requested."lastError"
		`,
        )
          .returnsRow(sqlRows5)
          .build(),
      ),
    );
    const reopen = released.filter((item) => item.reopenOutbox);
    if (reopen.length > 0) {
      const reopenValues = reopen.map(
        (item) => sql`(
					${item.dispatchId}::INTEGER,
					${item.publishAttempt}::INTEGER,
					${item.availableAt}::TIMESTAMP(3),
					${item.lastError}::VARCHAR(500)
				)`,
      );
      const reopened = await this.client
        .execute(
          sqlStatement(
            this.client,
            sql`
				UPDATE "PushDispatchOutbox" AS outbox
				SET
					"status" = 'PENDING'::"PushDispatchOutboxStatus",
					"availableAt" = requested."availableAt",
					"lockedAt" = NULL,
					"publishedAt" = NULL,
					"lastError" = requested."lastError",
					"updatedAt" = CURRENT_TIMESTAMP
				FROM (VALUES ${join(reopenValues)}) AS requested(
					"dispatchId", "publishAttempt", "availableAt", "lastError"
				)
				WHERE outbox."dispatchId" = requested."dispatchId"
					AND outbox."publishAttempts" = requested."publishAttempt"
					AND outbox."status" IN (
						'PROCESSING'::"PushDispatchOutboxStatus",
						'PUBLISHED'::"PushDispatchOutboxStatus"
					)
			`,
          )
            .affectedCount()
            .build(),
        )
        .then((result) => result.affectedRows);
      if (reopened !== reopen.length) {
        throw new Error(
          `Push delivery outbox reopen fence mismatch: expected=${reopen.length}, actual=${reopened}`,
        );
      }
    }
    return released.length;
  }

  recoverStaleProcessing(startedBefore: Date): Promise<number> {
    return this.client
      .execute(
        sqlStatement(
          this.client,
          sql`
			WITH locked_outboxes AS MATERIALIZED (
				SELECT outbox."dispatchId"
				FROM "PushDispatchOutbox" AS outbox
				INNER JOIN "PushDispatch" AS dispatch
					ON dispatch."id" = outbox."dispatchId"
				WHERE dispatch."status" = 'PROCESSING'::"PushDispatchStatus"
					AND dispatch."processingStartedAt" < ${startedBefore}
					ORDER BY outbox."availableAt" ASC, outbox."dispatchId" ASC
				FOR UPDATE OF outbox SKIP LOCKED
			),
			recovered AS (
				UPDATE "PushDispatch" AS dispatch
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
					AND dispatch."processingStartedAt" < ${startedBefore}
				RETURNING dispatch."id"
			)
			UPDATE "PushDispatchOutbox" AS outbox
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
		`,
        )
          .affectedCount()
          .build(),
      )
      .then((result) => result.affectedRows);
  }

  async #markOutboxesTerminal(publications: readonly PushDeliveryPublication[]): Promise<void> {
    if (publications.length === 0) return;
    const values = publications.map(
      (publication) =>
        sql`(${publication.dispatchId}::INTEGER, ${publication.publishAttempt}::INTEGER)`,
    );
    const terminal = await this.client
      .execute(
        sqlStatement(
          this.client,
          sql`
			UPDATE "PushDispatchOutbox" AS outbox
			SET
				"status" = 'PUBLISHED'::"PushDispatchOutboxStatus",
				"lockedAt" = NULL,
				"publishedAt" = COALESCE(outbox."publishedAt", CURRENT_TIMESTAMP),
				"lastError" = NULL,
				"updatedAt" = CURRENT_TIMESTAMP
			FROM (VALUES ${join(values)}) AS terminal("dispatchId", "publishAttempt")
			WHERE outbox."dispatchId" = terminal."dispatchId"
				AND outbox."publishAttempts" = terminal."publishAttempt"
				AND outbox."status" IN (
					'PROCESSING'::"PushDispatchOutboxStatus",
					'PUBLISHED'::"PushDispatchOutboxStatus"
				)
		`,
        )
          .affectedCount()
          .build(),
      )
      .then((result) => result.affectedRows);
    if (terminal !== publications.length) {
      throw new Error(
        `Push delivery terminal outbox fence mismatch: expected=${publications.length}, actual=${terminal}`,
      );
    }
  }

  async #reopenUnclaimedPublications(
    input: ReopenPushDeliveriesAfterClaimFailureInput,
  ): Promise<number> {
    if (input.publications.length === 0) return 0;
    await this.#lockOutboxGenerations(input.publications);
    const values = input.publications.map(
      (publication) =>
        sql`(${publication.dispatchId}::INTEGER, ${publication.publishAttempt}::INTEGER)`,
    );
    return this.client
      .execute(
        sqlStatement(
          this.client,
          sql`
			UPDATE "PushDispatchOutbox" AS outbox
			SET
				"status" = 'PENDING'::"PushDispatchOutboxStatus",
				"availableAt" = ${input.availableAt},
				"lockedAt" = NULL,
				"publishedAt" = NULL,
				"lastError" = ${input.error.slice(0, 500)},
				"updatedAt" = CURRENT_TIMESTAMP
			FROM (VALUES ${join(values)}) AS requested("dispatchId", "publishAttempt")
			WHERE outbox."dispatchId" = requested."dispatchId"
				AND outbox."publishAttempts" = requested."publishAttempt"
				AND outbox."status" IN (
					'PROCESSING'::"PushDispatchOutboxStatus",
					'PUBLISHED'::"PushDispatchOutboxStatus"
				)
				AND EXISTS (
					SELECT 1
					FROM "PushDispatch" AS dispatch
					WHERE dispatch."id" = requested."dispatchId"
						AND dispatch."status" = 'PENDING'::"PushDispatchStatus"
				)
		`,
        )
          .affectedCount()
          .build(),
      )
      .then((result) => result.affectedRows);
  }

  async #lockOutboxGenerations(publications: readonly PushDeliveryPublication[]): Promise<void> {
    const values = publications.map(
      (publication) =>
        sql`(${publication.dispatchId}::INTEGER, ${publication.publishAttempt}::INTEGER)`,
    );
    await this.client
      .execute(
        sqlStatement(
          this.client,
          sql`
			SELECT outbox."dispatchId"
			FROM (VALUES ${join(values)}) AS requested("dispatchId", "publishAttempt")
			INNER JOIN "PushDispatchOutbox" AS outbox
				ON outbox."dispatchId" = requested."dispatchId"
				AND outbox."publishAttempts" = requested."publishAttempt"
				AND outbox."status" IN (
					'PROCESSING'::"PushDispatchOutboxStatus",
					'PUBLISHED'::"PushDispatchOutboxStatus"
				)
			ORDER BY outbox."availableAt" ASC, outbox."dispatchId" ASC
			FOR UPDATE OF outbox
		`,
        )
          .affectedCount()
          .build(),
      )
      .then((result) => result.affectedRows);
  }
}
