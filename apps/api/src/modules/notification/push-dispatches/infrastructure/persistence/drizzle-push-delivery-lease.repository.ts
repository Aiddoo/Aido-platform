import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import {
  pushDispatch,
  pushDispatchOutbox,
  pushDispatchStatus,
} from "#api/platform/database/schema/index";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import type {
  PushDeliveryLeaseRepositoryPort,
  ReleasePushDeliveryInput,
} from "../../application/ports/push-delivery-lease.repository.port.js";
import {
  claimedOutboxStatus,
  fenceValues,
  FENCE_COLUMNS,
  heldLease,
  lockedRequests,
  setColumn,
} from "./push-delivery-lifecycle.query-fragment.js";

const STALE_PROCESSING_LEASE_ERROR = "STALE_PROCESSING_LEASE";

const releaseRowsSchema = z.array(
  z.object({ dispatchId: z.number(), publishAttempt: z.number(), reopenOutbox: z.boolean() }),
);

@Injectable()
export class DrizzlePushDeliveryLeaseRepository implements PushDeliveryLeaseRepositoryPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #clock: ClockPort;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>, clock: ClockPort) {
    this.#transactionHost = transactionHost;
    this.#clock = clock;
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
        // claim이 DB 시계(LOCALTIMESTAMP(3))로 비교하므로 같은 시계로 열어야 서버 시계가 앞서도 이번 relay가 바로 잡는다
        availableAt: sql`LOCALTIMESTAMP(3)`,
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

  get #db() {
    return this.#transactionHost.tx;
  }
}
