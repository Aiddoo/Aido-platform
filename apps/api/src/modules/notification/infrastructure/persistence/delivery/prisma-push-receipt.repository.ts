import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and } from "@prisma/orm-postgres/orm-client";
import sql, { join } from "sql-template-tag";

import { decodeRecord } from "#api/platform/database/database-records";
import { sqlStatement } from "#api/platform/database/database-sql";
import { varchar } from "#api/platform/database/database-values";
import { requireRecord } from "#api/platform/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import { now } from "#api/shared/domain/date/utils/core";

import type { PushReceiptResult } from "../../../application/ports/delivery/push-provider.port.js";
import type {
  PendingPushReceipt,
  PushReceiptRepositoryPort,
} from "../../../application/ports/delivery/push-receipt.repository.port.js";

@Injectable()
export class PrismaPushReceiptRepository implements PushReceiptRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  private get client() {
    return this.txHost.tx;
  }

  async findPendingPushReceipts(limit: number): Promise<PendingPushReceipt[]> {
    const rows = decodeRecord(
      "PushDeliveryAttempt",
      await this.client.orm.public.PushDeliveryAttempt.where((row) =>
        and(row.status.eq("TICKET_ACCEPTED"), row.expoTicketId.isNotNull()),
      )
        .select("expoTicketId")
        .include("pushToken", (related) => related.select("token"))
        .orderBy((row) => row.createdAt.asc())
        .limit(limit)
        .all(),
    );
    return rows.flatMap((row) =>
      row.expoTicketId
        ? [{ ticketId: row.expoTicketId, token: requireRecord(row.pushToken).token }]
        : [],
    );
  }

  async recordPushReceipts(results: PushReceiptResult[]): Promise<string[]> {
    if (results.length === 0) return [];

    const receiptCheckedAt = now();
    const values = results.map(
      (result) =>
        sql`(
					${result.ticketId}::VARCHAR(100),
					${result.delivered ? "DELIVERED" : "FAILED"}::"PushDeliveryStatus",
					${result.errorCode ?? null}::VARCHAR(100),
					${result.error?.slice(0, 500) ?? null}::VARCHAR(500)
				)`,
    );
    await this.client
      .execute(
        sqlStatement(
          this.client,
          sql`
			UPDATE "PushDeliveryAttempt" AS attempt
			SET
				"status" = receipt."status",
				"errorCode" = receipt."errorCode",
				"errorMessage" = receipt."errorMessage",
				"receiptCheckedAt" = ${receiptCheckedAt},
				"updatedAt" = ${receiptCheckedAt}
			FROM (
				VALUES ${join(values)}
			) AS receipt("ticketId", "status", "errorCode", "errorMessage")
			WHERE attempt."expoTicketId" = receipt."ticketId"
		`,
        )
          .affectedCount()
          .build(),
      )
      .then((result) => result.affectedRows);

    const invalidTicketIds = results.flatMap((result) =>
      result.errorCode === "DeviceNotRegistered" ? [result.ticketId] : [],
    );
    if (invalidTicketIds.length === 0) return [];
    const attempts = decodeRecord(
      "PushDeliveryAttempt",
      await this.client.orm.public.PushDeliveryAttempt.where((row) =>
        row.expoTicketId.in(invalidTicketIds.map((value) => varchar(value, 100))),
      )
        .include("pushToken", (related) => related.select("token"))
        .all(),
    );
    return attempts.map((attempt) => requireRecord(attempt.pushToken).token);
  }
}
