export type OutboundRejectionReason = "circuit-open" | "bulkhead-full";

/** 회로가 열렸거나 동시 호출·대기열이 가득 차서 외부 호출을 시작하지 않았다. */
export class OutboundRejectedError extends Error {
  readonly policy: string;
  readonly reason: OutboundRejectionReason;

  constructor(policy: string, reason: OutboundRejectionReason) {
    super(`Outbound call rejected: ${policy} ${reason}`);
    this.name = OutboundRejectedError.name;
    this.policy = policy;
    this.reason = reason;
  }
}

/** 시도별 제한 시간이 지나 기다리기를 멈췄다. SDK 요청은 계속될 수 있어 멱등 키가 필요하다. */
export class OutboundTimeoutError extends Error {
  readonly policy: string;
  readonly timeoutMs: number;

  constructor(policy: string, timeoutMs: number) {
    super(`Outbound call timed out: ${policy} after ${timeoutMs}ms`);
    this.name = OutboundTimeoutError.name;
    this.policy = policy;
    this.timeoutMs = timeoutMs;
  }
}
