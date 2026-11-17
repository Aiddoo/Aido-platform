import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, inArray, sql } from "drizzle-orm";
import { uniq } from "es-toolkit";
import { z } from "zod";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import {
  pushDeliveryAttempt,
  pushDispatch,
  pushDispatchOutbox,
  pushDispatchStatus,
  pushToken,
} from "#api/platform/database/schema/index";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import type {
  FinalizePushDeliveryResultsInput,
  FinalizeSkippedPushDeliveryInput,
  PushDeliveryFinalizationRepositoryPort,
} from "../../application/ports/push-delivery-finalization.repository.port.js";
import type { PushDeliveryPublicationReadModel } from "../../application/read-models/push-delivery.read-model.js";
import { toAttemptOutcome } from "./push-delivery-attempt.mapper.js";
import {
  claimedOutboxStatus,
  fenceValues,
  FENCE_COLUMNS,
  heldLease,
  lockedRequests,
  setColumn,
} from "./push-delivery-lifecycle.query-fragment.js";
import { matchesPublicationGeneration } from "./push-outbox-generation.mapper.js";
import { pushTokenFingerprint } from "./push-token-fingerprint.mapper.js";

const publicationRowsSchema = z.array(
  z.object({ dispatchId: z.number(), publishAttempt: z.number() }),
);

function excluded(column: { readonly name: string }) {
  return sql`excluded.${sql.identifier(column.name)}`;
}

@Injectable()
export class DrizzlePushDeliveryFinalizationRepository implements PushDeliveryFinalizationRepositoryPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #clock: ClockPort;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>, clock: ClockPort) {
    this.#transactionHost = transactionHost;
    this.#clock = clock;
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

  async #markOutboxesTerminal(
    publications: readonly PushDeliveryPublicationReadModel[],
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

  get #db() {
    return this.#transactionHost.tx;
  }
}
