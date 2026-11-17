import { and, eq, or } from "drizzle-orm";

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
