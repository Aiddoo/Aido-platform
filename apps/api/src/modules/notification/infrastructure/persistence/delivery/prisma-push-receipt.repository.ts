import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and } from "@prisma/orm-postgres/orm-client";
import sql, { join } from "sql-template-tag";

import { decodeRecord } from "#api/platform/database/database-records";
import { decodeSqlRows, sqlRowSpec, sqlStatement } from "#api/platform/database/database-sql";
import { databaseTimestamp } from "#api/platform/database/database-values";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
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

@Injectable()
export class PrismaPushReceiptRepository implements PushReceiptRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  private get client() {
    return this.txHost.tx;
  }

  async findPendingPushReceipts(limit: number): Promise<PendingPushReceipt[]> {
    const checkedAt = now();
    const oldest = new Date(checkedAt.getTime() - RECEIPT_MAX_AGE_MS);
    const newest = new Date(checkedAt.getTime() - RECEIPT_MIN_AGE_MS);
    const rows = decodeRecord(
      "PushDeliveryAttempt",
      await this.client.orm.public.PushDeliveryAttempt.where((row) =>
        and(
          row.status.eq("TICKET_ACCEPTED"),
          row.expoTicketId.isNotNull(),
          row.createdAt.gte(databaseTimestamp(oldest)),
          row.createdAt.lte(databaseTimestamp(newest)),
        ),
      )
        .select("expoTicketId")
        .orderBy((row) => row.createdAt.asc())
        .orderBy((row) => row.id.asc())
        .limit(limit)
        .all(),
    );
    return rows.flatMap((row) =>
      row.expoTicketId !== null ? [{ ticketId: row.expoTicketId }] : [],
    );
  }

  async recordPushReceipts(results: PushReceiptResult[]): Promise<InvalidPushToken[]> {
    if (results.length === 0) return [];

    const receiptCheckedAt = now();
    const values = results.map(
      (result) => sql`(
      ${result.ticketId}::VARCHAR(100),
      ${result.delivered ? "DELIVERED" : "FAILED"}::"PushDeliveryStatus",
      ${result.errorCode ?? null}::VARCHAR(100),
      ${result.error?.slice(0, 500) ?? null}::VARCHAR(500)
    )`,
    );
    const rows = sqlRowSpec({
      userId: "pg/text@1",
      token: "pg/text@1",
      tokenFingerprint: { codecId: "pg/text@1", nullable: true },
    });
    const invalidAttempts = decodeSqlRows(
      rows,
      await this.client.query(
        sqlStatement(
          this.client,
          sql`
        WITH updated AS (
          UPDATE "PushDeliveryAttempt" AS attempt
          SET "status" = receipt."status",
              "errorCode" = receipt."errorCode",
              "errorMessage" = receipt."errorMessage",
              "receiptCheckedAt" = ${receiptCheckedAt},
              "updatedAt" = ${receiptCheckedAt}
          FROM (VALUES ${join(values)}) AS receipt("ticketId", "status", "errorCode", "errorMessage")
          WHERE attempt."expoTicketId" = receipt."ticketId"
            AND attempt."status" = 'TICKET_ACCEPTED'
          RETURNING attempt."pushTokenId", attempt."tokenFingerprint", attempt."status", attempt."errorCode"
        )
        SELECT token."userId", token."token", updated."tokenFingerprint"
        FROM updated
        JOIN "PushToken" AS token ON token."id" = updated."pushTokenId"
        WHERE updated."status" = 'FAILED' AND updated."errorCode" = 'DeviceNotRegistered'
      `,
        )
          .returnsRow(rows)
          .build(),
      ),
    );
    return invalidAttempts.flatMap((attempt) =>
      attempt.tokenFingerprint !== null &&
      attempt.tokenFingerprint === pushTokenFingerprint(attempt.token)
        ? [{ userId: attempt.userId, token: attempt.token }]
        : [],
    );
  }
}
