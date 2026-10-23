import { and, or, type ModelAccessor } from "@prisma/orm-postgres/orm-client";

import type { Contract } from "#api/generated/prisma8/contract.d";
import type { PushDispatchOutboxStatus } from "#api/platform/database/database.types";
import type { Prisma8Transaction } from "#api/platform/database/prisma8-transactional.adapter";

import type { PushDeliveryPublication } from "../../../application/types/delivery/push-delivery.types.js";

type OutboxRow = ModelAccessor<Contract, "PushDispatchOutbox", "public">;

/** 발행 세대(dispatchId, publishAttempts)가 일치하는 outbox 행만 고른다. */
export function matchesPublicationGeneration(
  publications: readonly PushDeliveryPublication[],
): (outbox: OutboxRow) => ReturnType<typeof or> {
  return (outbox) =>
    or(
      ...publications.map((publication) =>
        and(
          outbox.dispatchId.eq(publication.dispatchId),
          outbox.publishAttempts.eq(publication.publishAttempt),
        ),
      ),
    );
}

/** claim과 같은 (availableAt, dispatchId) 순서로 잠가 동시 정리 사이의 deadlock을 막는다. */
export async function lockPublicationGenerations(
  client: Prisma8Transaction,
  publications: readonly PushDeliveryPublication[],
  statuses: readonly PushDispatchOutboxStatus[],
): Promise<void> {
  const matchesGeneration = matchesPublicationGeneration(publications);
  await client.orm.public.PushDispatchOutbox.where((outbox) =>
    and(matchesGeneration(outbox), outbox.status.in([...statuses])),
  )
    .orderBy([(outbox) => outbox.availableAt.asc(), (outbox) => outbox.dispatchId.asc()])
    .select("dispatchId")
    .forUpdate()
    .all();
}
