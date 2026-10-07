export interface BroadcastResult {
  readonly successCount: number;
  readonly failCount: number;
  readonly totalTargets: number;
}

export function buildBroadcastResult(totalTargets: number, successCount: number): BroadcastResult {
  return { successCount, failCount: totalTargets - successCount, totalTargets };
}
