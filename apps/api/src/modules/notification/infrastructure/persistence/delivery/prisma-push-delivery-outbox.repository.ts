import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and } from "@prisma/orm-postgres/orm-client";
import sql, { empty, join, type Sql } from "sql-template-tag";

import { encodePatch } from "#api/platform/database/database-records";
import { decodeSqlRows, sqlRowSpec, sqlStatement } from "#api/platform/database/database-sql";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";

import type {
  ClaimPushDeliveryOutboxInput,
  DeferPushDeliveryPublicationsInput,
  PushDeliveryOutboxRepositoryPort,
} from "../../../application/ports/delivery/push-delivery-outbox.repository.port.js";
import type { PushDeliveryPublication } from "../../../application/types/delivery/push-delivery.types.js";
import {
  lockPublicationGenerations,
  matchesPublicationGeneration,
} from "./push-outbox-generation.js";

@Injectable()
export class PrismaPushDeliveryOutboxRepository implements PushDeliveryOutboxRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  private get client() {
    return this.txHost.tx;
  }

  claimByDispatchIds(
    dispatchIds: readonly number[],
    lockedAt: Date,
  ): Promise<readonly PushDeliveryPublication[]> {
    if (dispatchIds.length === 0) return Promise.resolve([]);
    return this.#claim({
      limit: dispatchIds.length,
      lockedAt,
      dispatchFilter: sql`AND candidate."dispatchId" IN (${join(dispatchIds)})`,
    });
  }

  claimAvailable(input: ClaimPushDeliveryOutboxInput): Promise<readonly PushDeliveryPublication[]> {
    if (input.limit <= 0) return Promise.resolve([]);
    return this.#claim({
      limit: input.limit,
      lockedAt: input.lockedAt,
      dispatchFilter: empty,
    });
  }

  async markPublished(
    publications: readonly PushDeliveryPublication[],
    publishedAt: Date,
  ): Promise<number> {
    if (publications.length === 0) return 0;
    await lockPublicationGenerations(this.client, publications, ["PROCESSING"]);
    return this.processingGenerations(publications).updateAndCount(
      encodePatch("PushDispatchOutbox", {
        status: "PUBLISHED",
        lockedAt: null,
        publishedAt,
        lastError: null,
      }),
    );
  }

  async defer(input: DeferPushDeliveryPublicationsInput): Promise<number> {
    if (input.publications.length === 0) return 0;
    await lockPublicationGenerations(this.client, input.publications, ["PROCESSING"]);
    return this.processingGenerations(input.publications).updateAndCount(
      encodePatch("PushDispatchOutbox", {
        status: "PENDING",
        availableAt: input.availableAt,
        lockedAt: null,
        publishedAt: null,
        lastError: input.error.slice(0, 500),
      }),
    );
  }

  /** 발행 세대와 PROCESSING 상태를 UPDATE 술어에 남겨 다른 worker가 재claim한 행을 덮어쓰지 않는다. */
  private processingGenerations(publications: readonly PushDeliveryPublication[]) {
    const matchesGeneration = matchesPublicationGeneration(publications);
    return this.client.orm.public.PushDispatchOutbox.where((outbox) =>
      and(matchesGeneration(outbox), outbox.status.eq("PROCESSING")),
    );
  }
  async recoverStaleProcessing(lockedBefore: Date): Promise<number> {
    return this.client
      .execute(
        sqlStatement(
          this.client,
          sql`
			WITH locked_outboxes AS MATERIALIZED (
				SELECT
					outbox."dispatchId",
					dispatch."status" AS "dispatchStatus"
				FROM "PushDispatchOutbox" AS outbox
				INNER JOIN "PushDispatch" AS dispatch
					ON dispatch."id" = outbox."dispatchId"
				WHERE outbox."status" = 'PROCESSING'::"PushDispatchOutboxStatus"
					AND outbox."lockedAt" < ${lockedBefore}
					AND dispatch."status" <> 'PROCESSING'::"PushDispatchStatus"
					ORDER BY outbox."availableAt" ASC, outbox."dispatchId" ASC
				FOR UPDATE OF outbox SKIP LOCKED
			)
			UPDATE "PushDispatchOutbox" AS outbox
			SET
				"status" = CASE
					WHEN locked_outboxes."dispatchStatus" IN (
						'SENT'::"PushDispatchStatus",
						'SKIPPED'::"PushDispatchStatus",
						'FAILED'::"PushDispatchStatus",
						'HOLDOUT'::"PushDispatchStatus"
					) THEN 'PUBLISHED'::"PushDispatchOutboxStatus"
					ELSE 'PENDING'::"PushDispatchOutboxStatus"
				END,
				"lockedAt" = NULL,
				"publishedAt" = CASE
					WHEN locked_outboxes."dispatchStatus" IN (
						'SENT'::"PushDispatchStatus",
						'SKIPPED'::"PushDispatchStatus",
						'FAILED'::"PushDispatchStatus",
						'HOLDOUT'::"PushDispatchStatus"
					) THEN COALESCE(outbox."publishedAt", CURRENT_TIMESTAMP)
					ELSE NULL
				END,
				"updatedAt" = CURRENT_TIMESTAMP
			FROM locked_outboxes
			WHERE outbox."dispatchId" = locked_outboxes."dispatchId"
				AND outbox."status" = 'PROCESSING'::"PushDispatchOutboxStatus"
		`,
        )
          .affectedCount()
          .build(),
      )
      .then((result) => result.affectedRows);
  }

  async #claim(input: {
    readonly limit: number;
    readonly lockedAt: Date;
    readonly dispatchFilter: Sql;
  }): Promise<readonly PushDeliveryPublication[]> {
    const sqlRows1 = sqlRowSpec({ dispatchId: "pg/int4@1", publishAttempt: "pg/int4@1" });

    return await this.client
      .query(
        sqlStatement(
          this.client,
          sql`
			UPDATE "PushDispatchOutbox" AS outbox
			SET
				"status" = 'PROCESSING'::"PushDispatchOutboxStatus",
				"lockedAt" = ${input.lockedAt},
				"publishedAt" = NULL,
				"publishAttempts" = outbox."publishAttempts" + 1,
				"lastError" = NULL,
				"updatedAt" = CURRENT_TIMESTAMP
			WHERE outbox."dispatchId" IN (
				SELECT candidate."dispatchId"
				FROM "PushDispatchOutbox" AS candidate
				WHERE candidate."status" = 'PENDING'::"PushDispatchOutboxStatus"
					AND candidate."availableAt" <= CURRENT_TIMESTAMP
					${input.dispatchFilter}
				ORDER BY candidate."availableAt" ASC, candidate."dispatchId" ASC
				LIMIT ${input.limit}
				FOR UPDATE SKIP LOCKED
			)
			RETURNING outbox."dispatchId", outbox."publishAttempts" AS "publishAttempt"
		`,
        )
          .returnsRow(sqlRows1)
          .build(),
      )
      .then((rows) => decodeSqlRows(sqlRows1, rows));
  }
}
