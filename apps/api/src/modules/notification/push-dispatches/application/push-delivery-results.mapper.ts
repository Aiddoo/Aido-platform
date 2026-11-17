import { revokesPushToken } from "../domain/push-failure-kind.constants.js";
import type { PushResult } from "./ports/push-provider.port.js";

export function tokensToRevoke(results: readonly PushResult[]): string[] {
  return results.flatMap((result) =>
    result.status === "rejected" && revokesPushToken(result.failure.kind) ? [result.token] : [],
  );
}

export function countOutcomes(results: readonly PushResult[]): {
  readonly successCount: number;
  readonly failureCount: number;
} {
  const successCount = results.filter((result) => result.status === "accepted").length;
  return { successCount, failureCount: results.length - successCount };
}
