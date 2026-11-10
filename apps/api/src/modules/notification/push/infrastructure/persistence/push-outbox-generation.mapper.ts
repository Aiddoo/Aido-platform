import type { TransactionHost } from "@nestjs-cls/transactional";
import { and, asc, eq, inArray, or } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { pushDispatchOutbox, pushDispatchOutboxStatus } from "#api/platform/database/schema/index";

import type { PushDeliveryPublication } from "../../application/read-models/push-delivery.read-model.js";

export type OutboxStatus = (typeof pushDispatchOutboxStatus.enumValues)[number];

/** 발행 세대(dispatchId, publishAttempts)가 일치하는 outbox 행만 고른다. */
export function matchesPublicationGeneration(publications: readonly PushDeliveryPublication[]) {
  return or(
    ...publications.map((publication) =>
      and(
        eq(pushDispatchOutbox.dispatchId, publication.dispatchId),
        eq(pushDispatchOutbox.publishAttempts, publication.publishAttempt),
      ),
    ),
  );
}

/** claim과 같은 (availableAt, dispatchId) 순서로 잠가 동시 정리 사이의 deadlock을 막는다. */
export async function lockPublicationGenerations(
  db: TransactionHost<DrizzleTransactionalAdapter>["tx"],
  publications: readonly PushDeliveryPublication[],
  statuses: readonly OutboxStatus[],
): Promise<void> {
  await db
    .select({ dispatchId: pushDispatchOutbox.dispatchId })
    .from(pushDispatchOutbox)
    .where(
      and(
        matchesPublicationGeneration(publications),
        inArray(pushDispatchOutbox.status, [...statuses]),
      ),
    )
    .orderBy(asc(pushDispatchOutbox.availableAt), asc(pushDispatchOutbox.dispatchId))
    .for("update");
}
