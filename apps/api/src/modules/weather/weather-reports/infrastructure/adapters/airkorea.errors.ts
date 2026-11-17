export type AirkoreaOperation = "nearby_station" | "air_quality";

export type AirkoreaFailureReason =
  | "http_failure"
  | "invalid_structure"
  | "provider_result"
  | "recent_failure";

/** 에어코리아가 답하지 못한 호출. 측정값 없음(null)과 달리 캐시하지 않고 다음 조회가 다시 부른다. */
export class AirkoreaRequestError extends Error {
  readonly operation: AirkoreaOperation;
  readonly reason: AirkoreaFailureReason;

  constructor(operation: AirkoreaOperation, reason: AirkoreaFailureReason) {
    super(`AirKorea ${operation} request failed: ${reason}`);
    this.name = "AirkoreaRequestError";
    this.operation = operation;
    this.reason = reason;
  }
}
