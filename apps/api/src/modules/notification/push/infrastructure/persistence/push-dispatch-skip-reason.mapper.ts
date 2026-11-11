import { PUSH_DISPATCH_SKIP_REASON, type PushDispatchSkipReason } from "@aido/api/vocabulary";

const SKIP_REASONS: ReadonlySet<string> = new Set(Object.values(PUSH_DISPATCH_SKIP_REASON));

function isPushDispatchSkipReason(reason: string | null): reason is PushDispatchSkipReason {
  return reason != null && SKIP_REASONS.has(reason);
}

// 어휘에 없는 옛 사유 행은 버린다
export function toSkippedByReason(
  rows: readonly { readonly reason: string | null; readonly total: number }[],
): ReadonlyMap<PushDispatchSkipReason, number> {
  return new Map(
    rows.flatMap((row) =>
      isPushDispatchSkipReason(row.reason) ? [[row.reason, row.total] as const] : [],
    ),
  );
}
