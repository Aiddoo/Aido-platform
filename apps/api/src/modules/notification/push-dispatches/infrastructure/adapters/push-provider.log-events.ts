export const PushProviderLogEvent = {
  TICKET_FAILED: "notification.push-ticket.failed",
  TRANSPORT_FAILED: "notification.push-transport.failed",
} as const;

export function pushTransportStatusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error == null || !("statusCode" in error)) {
    return undefined;
  }
  const value = error.statusCode;
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : undefined;
}
