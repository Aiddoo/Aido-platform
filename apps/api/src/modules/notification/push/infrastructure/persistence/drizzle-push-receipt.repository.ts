import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, gte, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { pushDeliveryAttempt, pushToken } from "#api/platform/database/schema/index";

import type { PushReceiptResult } from "../../application/ports/push-provider.port.js";
import type {
  InvalidPushToken,
  PushReceiptRepositoryPort,
} from "../../application/ports/push-receipt.repository.port.js";
import { PUSH_FAILURE_KIND, revokesPushToken } from "../../domain/push-failure-kind.constants.js";
import type { PushReceiptCheckWindow } from "../../domain/push-receipt.domain-service.js";
import { pushTokenFingerprint } from "./push-token-fingerprint.mapper.js";

const TOKEN_REVOKING_FAILURE_KINDS = Object.values(PUSH_FAILURE_KIND).filter(revokesPushToken);

const invalidAttemptSchema = z.object({
  userId: z.string(),
  token: z.string(),
  tokenFingerprint: z.string().nullable(),
});

@Injectable()
export class DrizzlePushReceiptRepository implements PushReceiptRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async findPendingTicketIds(window: PushReceiptCheckWindow, limit: number): Promise<string[]> {
    const rows = await this.#db
      .select({ ticketId: pushDeliveryAttempt.providerTicketId })
      .from(pushDeliveryAttempt)
      .where(
        and(
          eq(pushDeliveryAttempt.status, "TICKET_ACCEPTED"),
          isNotNull(pushDeliveryAttempt.providerTicketId),
          gte(pushDeliveryAttempt.createdAt, window.acceptedAfter),
          lte(pushDeliveryAttempt.createdAt, window.acceptedBefore),
          or(
            isNull(pushDeliveryAttempt.receiptCheckedAt),
            lte(pushDeliveryAttempt.receiptCheckedAt, window.checkedBefore),
          ),
        ),
      )
      .orderBy(
        asc(
          sql`COALESCE(${pushDeliveryAttempt.receiptCheckedAt}, ${pushDeliveryAttempt.createdAt})`,
        ),
        asc(pushDeliveryAttempt.id),
      )
      .limit(limit);
    return rows.flatMap((row) => (row.ticketId == null ? [] : [row.ticketId]));
  }

  async recordPushReceipts(input: {
    readonly requestedTicketIds: readonly string[];
    readonly results: readonly PushReceiptResult[];
    readonly checkedAt: Temporal.Instant;
  }): Promise<InvalidPushToken[]> {
    if (input.requestedTicketIds.length === 0) {
      return [];
    }
    const invalidTokens = await this.#recordTerminalReceipts(input.results, input.checkedAt);
    await this.#db
      .update(pushDeliveryAttempt)
      .set({ receiptCheckedAt: input.checkedAt, updatedAt: input.checkedAt })
      .where(
        and(
          inArray(pushDeliveryAttempt.providerTicketId, [...input.requestedTicketIds]),
          eq(pushDeliveryAttempt.status, "TICKET_ACCEPTED"),
        ),
      );
    return invalidTokens;
  }

  async expireUnreceipted(acceptedBefore: Temporal.Instant, limit: number): Promise<number> {
    const { rows } = await this.#db.execute<Record<string, unknown>>(sql`
      UPDATE ${pushDeliveryAttempt}
      SET "status" = 'UNKNOWN'::"PushDeliveryStatus",
          "failureKind" = ${PUSH_FAILURE_KIND.RECEIPT_EXPIRED},
          "receiptCheckedAt" = CURRENT_TIMESTAMP,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" IN (
        SELECT "id" FROM ${pushDeliveryAttempt}
        WHERE "status" = 'TICKET_ACCEPTED'::"PushDeliveryStatus"
          AND "createdAt" < ${sql.param(acceptedBefore, pushDeliveryAttempt.createdAt)}
        ORDER BY "createdAt" ASC, "id" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id"
    `);
    return rows.length;
  }

  async #recordTerminalReceipts(
    results: readonly PushReceiptResult[],
    checkedAt: Temporal.Instant,
  ): Promise<InvalidPushToken[]> {
    if (results.length === 0) {
      return [];
    }
    const values = results.map((result) => {
      const failure = result.status === "failed" ? result.failure : undefined;
      return sql`(
        ${result.ticketId}::VARCHAR(100),
        ${result.status === "delivered" ? "DELIVERED" : "FAILED"}::"PushDeliveryStatus",
        ${failure?.kind ?? null}::VARCHAR(40),
        ${failure?.providerCode ?? null}::VARCHAR(100),
        ${failure?.message?.slice(0, 500) ?? null}::VARCHAR(500)
      )`;
    });
    const { rows } = await this.#db.execute<Record<string, unknown>>(sql`
      WITH updated AS (
        UPDATE ${pushDeliveryAttempt} AS attempt
        SET "status" = receipt."status",
            "failureKind" = receipt."failureKind",
            "errorCode" = receipt."errorCode",
            "errorMessage" = receipt."errorMessage",
            "receiptCheckedAt" = ${sql.param(checkedAt, pushDeliveryAttempt.receiptCheckedAt)},
            "updatedAt" = ${sql.param(checkedAt, pushDeliveryAttempt.updatedAt)}
        FROM (VALUES ${sql.join(values, sql`, `)}) AS receipt("ticketId", "status", "failureKind", "errorCode", "errorMessage")
        WHERE attempt."expoTicketId" = receipt."ticketId"
          AND attempt."status" = 'TICKET_ACCEPTED'
        RETURNING attempt."pushTokenId", attempt."tokenFingerprint", attempt."failureKind"
      )
      SELECT token."userId", token."token", updated."tokenFingerprint"
      FROM updated
      JOIN ${pushToken} AS token ON token."id" = updated."pushTokenId"
      WHERE updated."failureKind" IN (${sql.join(
        TOKEN_REVOKING_FAILURE_KINDS.map((kind) => sql`${kind}`),
        sql`, `,
      )})
    `);
    return z
      .array(invalidAttemptSchema)
      .parse(rows)
      .flatMap((attempt) =>
        attempt.tokenFingerprint != null &&
        attempt.tokenFingerprint === pushTokenFingerprint(attempt.token)
          ? [{ userId: attempt.userId, token: attempt.token }]
          : [],
      );
  }
}
