const REVENUECAT_REQUEST_ERROR_REASONS = ["http", "invalid_response"] as const;

type RevenueCatRequestErrorReason = (typeof REVENUECAT_REQUEST_ERROR_REASONS)[number];

/** RevenueCat이 실패로 응답했다. 응답 본문은 담지 않는다. */
export class RevenueCatRequestError extends Error {
  readonly reason: RevenueCatRequestErrorReason;
  readonly statusCode: number | null;

  constructor(reason: RevenueCatRequestErrorReason, statusCode: number | null) {
    super(`RevenueCat request failed: ${reason}`);
    this.name = "RevenueCatRequestError";
    this.reason = reason;
    this.statusCode = statusCode;
  }
}

export function revenueCatRequestFailed(
  reason: RevenueCatRequestErrorReason,
  statusCode: number | null,
): RevenueCatRequestError {
  return new RevenueCatRequestError(reason, statusCode);
}
