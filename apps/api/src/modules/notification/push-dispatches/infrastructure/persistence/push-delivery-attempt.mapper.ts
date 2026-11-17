import type { pushDeliveryAttempt } from "#api/platform/database/schema/index";

import type { PushResult } from "../../application/ports/push-provider.port.js";

type PushDeliveryAttemptOutcome = Pick<
  typeof pushDeliveryAttempt.$inferInsert,
  "status" | "providerTicketId" | "failureKind" | "errorCode" | "errorMessage"
>;

export function toAttemptOutcome(result: PushResult): PushDeliveryAttemptOutcome {
  if (result.status === "accepted") {
    return {
      status: "TICKET_ACCEPTED",
      providerTicketId: result.ticketId,
      failureKind: null,
      errorCode: null,
      errorMessage: null,
    };
  }
  return {
    status: "FAILED",
    providerTicketId: null,
    failureKind: result.failure.kind,
    errorCode: result.failure.providerCode ?? null,
    errorMessage: result.failure.message?.slice(0, 500) ?? null,
  };
}
