import type { pushDeliveryAttempt } from "#api/platform/database/schema/index";

import type { PushSendResult } from "../../application/ports/push-channel.port.js";

type PushDeliveryAttemptOutcome = Pick<
  typeof pushDeliveryAttempt.$inferInsert,
  "status" | "providerTicketId" | "failureKind" | "errorCode" | "errorMessage"
>;

export function toAttemptOutcome(result: PushSendResult): PushDeliveryAttemptOutcome {
  if (result.status === "accepted") {
    return {
      status: "TICKET_ACCEPTED",
      providerTicketId: result.ticketId.value,
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
