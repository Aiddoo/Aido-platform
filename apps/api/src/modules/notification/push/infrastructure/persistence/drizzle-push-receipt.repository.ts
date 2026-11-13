import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, gte, inArray, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import {
  pushDeliveryAttempt,
  pushDeliveryStatus,
  pushToken,
} from "#api/platform/database/schema/index";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import type { PushReceiptResult } from "../../application/ports/push-provider.port.js";
import type {
  InvalidPushToken,
  PushReceiptRepositoryPort,
} from "../../application/ports/push-receipt.repository.port.js";
import { PUSH_FAILURE_KIND, revokesPushToken } from "../../domain/push-failure-kind.constants.js";
import type { PushReceiptCheckWindow } from "../../domain/push-receipt.domain-service.js";
import { pushTokenFingerprint } from "./push-token-fingerprint.mapper.js";

const TOKEN_REVOKING_FAILURE_KINDS: ReadonlySet<string> = new Set(
  Object.values(PUSH_FAILURE_KIND).filter(revokesPushToken),
);

@Injectable()
export class DrizzlePushReceiptRepository implements PushReceiptRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #clock: ClockPort;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>, clock: ClockPort) {
    this.#txHost = txHost;
    this.#clock = clock;
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
    const now = this.#clock.now();
    const unreceipted = this.#db
      .select({ id: pushDeliveryAttempt.id })
      .from(pushDeliveryAttempt)
      .where(
        and(
          eq(pushDeliveryAttempt.status, "TICKET_ACCEPTED"),
          lt(pushDeliveryAttempt.createdAt, acceptedBefore),
        ),
      )
      .orderBy(asc(pushDeliveryAttempt.createdAt), asc(pushDeliveryAttempt.id))
      .limit(limit)
      .for("update", { skipLocked: true });
    const expired = await this.#db
      .update(pushDeliveryAttempt)
      .set({
        status: "UNKNOWN",
        failureKind: PUSH_FAILURE_KIND.RECEIPT_EXPIRED,
        receiptCheckedAt: now,
        updatedAt: now,
      })
      .where(inArray(pushDeliveryAttempt.id, unreceipted))
      .returning({ id: pushDeliveryAttempt.id });
    return expired.length;
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
        ${result.status === "delivered" ? "DELIVERED" : "FAILED"}::${pushDeliveryStatus},
        ${failure?.kind ?? null}::VARCHAR(40),
        ${failure?.providerCode ?? null}::VARCHAR(100),
        ${failure?.message?.slice(0, 500) ?? null}::VARCHAR(500)
      )`;
    });
    // 이미 끝난 ticket의 중복 응답은 되돌리지 않도록 TICKET_ACCEPTED인 행만 ticket마다 다른 결과로 닫는다
    const closed = await this.#db
      .update(pushDeliveryAttempt)
      .set({
        status: sql`receipt."status"`,
        failureKind: sql`receipt."failureKind"`,
        errorCode: sql`receipt."errorCode"`,
        errorMessage: sql`receipt."errorMessage"`,
        receiptCheckedAt: checkedAt,
        updatedAt: checkedAt,
      })
      .from(
        sql`(VALUES ${sql.join(values, sql`, `)}) AS receipt("ticketId", "status", "failureKind", "errorCode", "errorMessage")`,
      )
      .where(
        and(
          eq(pushDeliveryAttempt.providerTicketId, sql`receipt."ticketId"`),
          eq(pushDeliveryAttempt.status, "TICKET_ACCEPTED"),
        ),
      )
      .returning({
        pushTokenId: pushDeliveryAttempt.pushTokenId,
        tokenFingerprint: pushDeliveryAttempt.tokenFingerprint,
        failureKind: pushDeliveryAttempt.failureKind,
      });
    const revoking = closed.filter(
      (attempt) =>
        attempt.failureKind != null && TOKEN_REVOKING_FAILURE_KINDS.has(attempt.failureKind),
    );
    if (revoking.length === 0) {
      return [];
    }
    const tokens = await this.#db
      .select({ id: pushToken.id, userId: pushToken.userId, token: pushToken.token })
      .from(pushToken)
      .where(
        inArray(
          pushToken.id,
          revoking.map(({ pushTokenId }) => pushTokenId),
        ),
      );
    const tokenById = new Map(tokens.map((token) => [token.id, token]));
    return revoking.flatMap((attempt) => {
      const token = tokenById.get(attempt.pushTokenId);
      return token != null &&
        attempt.tokenFingerprint != null &&
        attempt.tokenFingerprint === pushTokenFingerprint(token.token)
        ? [{ userId: token.userId, token: token.token }]
        : [];
    });
  }
}
