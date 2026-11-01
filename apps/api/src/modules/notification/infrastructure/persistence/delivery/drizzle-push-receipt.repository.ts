import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { z } from "zod";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { pushDeliveryAttempt, pushToken } from "#api/platform/database/schema/index";
import { now } from "#api/shared/domain/date/utils/core";

import type { PushReceiptResult } from "../../../application/ports/delivery/push-provider.port.js";
import type {
  InvalidPushToken,
  PendingPushReceipt,
  PushReceiptRepositoryPort,
} from "../../../application/ports/delivery/push-receipt.repository.port.js";
import { pushTokenFingerprint } from "./push-token-fingerprint.js";

const RECEIPT_MIN_AGE_MS = 15 * 60 * 1000;
const RECEIPT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const invalidAttemptSchema = z.object({
  userId: z.string(),
  token: z.string(),
  tokenFingerprint: z.string().nullable(),
});

@Injectable()
export class DrizzlePushReceiptRepository implements PushReceiptRepositoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  async findPendingPushReceipts(limit: number): Promise<PendingPushReceipt[]> {
    const checkedAt = now();
    const oldest = new Date(checkedAt.getTime() - RECEIPT_MAX_AGE_MS);
    const newest = new Date(checkedAt.getTime() - RECEIPT_MIN_AGE_MS);
    const rows = await this.db
      .select({ expoTicketId: pushDeliveryAttempt.expoTicketId })
      .from(pushDeliveryAttempt)
      .where(
        and(
          eq(pushDeliveryAttempt.status, "TICKET_ACCEPTED"),
          isNotNull(pushDeliveryAttempt.expoTicketId),
          gte(pushDeliveryAttempt.createdAt, oldest),
          lte(pushDeliveryAttempt.createdAt, newest),
        ),
      )
      .orderBy(asc(pushDeliveryAttempt.createdAt), asc(pushDeliveryAttempt.id))
      .limit(limit);
    return rows.flatMap((row) =>
      row.expoTicketId != null ? [{ ticketId: row.expoTicketId }] : [],
    );
  }

  async recordPushReceipts(results: PushReceiptResult[]): Promise<InvalidPushToken[]> {
    if (results.length === 0) {
      return [];
    }

    const receiptCheckedAt = now();
    const values = results.map(
      (result) => sql`(
        ${result.ticketId}::VARCHAR(100),
        ${result.delivered ? "DELIVERED" : "FAILED"}::"PushDeliveryStatus",
        ${result.errorCode ?? null}::VARCHAR(100),
        ${result.error?.slice(0, 500) ?? null}::VARCHAR(500)
      )`,
    );
    const { rows } = await this.db.execute<Record<string, unknown>>(sql`
      WITH updated AS (
        UPDATE ${pushDeliveryAttempt} AS attempt
        SET "status" = receipt."status",
            "errorCode" = receipt."errorCode",
            "errorMessage" = receipt."errorMessage",
            "receiptCheckedAt" = ${sql.param(receiptCheckedAt, pushDeliveryAttempt.receiptCheckedAt)},
            "updatedAt" = ${sql.param(receiptCheckedAt, pushDeliveryAttempt.updatedAt)}
        FROM (VALUES ${sql.join(values, sql`, `)}) AS receipt("ticketId", "status", "errorCode", "errorMessage")
        WHERE attempt."expoTicketId" = receipt."ticketId"
          AND attempt."status" = 'TICKET_ACCEPTED'
        RETURNING attempt."pushTokenId", attempt."tokenFingerprint", attempt."status", attempt."errorCode"
      )
      SELECT token."userId", token."token", updated."tokenFingerprint"
      FROM updated
      JOIN ${pushToken} AS token ON token."id" = updated."pushTokenId"
      WHERE updated."status" = 'FAILED' AND updated."errorCode" = 'DeviceNotRegistered'
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
