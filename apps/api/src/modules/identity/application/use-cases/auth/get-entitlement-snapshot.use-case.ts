import type { EntitlementSnapshot } from "@aido/api";

import type { QuotaLedgerPort } from "#api/modules/access/access-quota.public";
import type { DailySendUsageReaderPort } from "#api/modules/social/social-cheers.public";

export interface GetEntitlementSnapshotInput {
  readonly userId: string;
  /** 응원·찌르기 일간 사용량의 하루 기준(X-Timezone) */
  readonly timezone: string;
}

interface GetEntitlementSnapshotDependencies {
  readonly quotaLedger: Pick<QuotaLedgerPort, "readSnapshot">;
  readonly cheerUsageReader: Pick<DailySendUsageReaderPort, "readDailyUsage">;
  readonly nudgeUsageReader: Pick<DailySendUsageReaderPort, "readDailyUsage">;
}

/**
 * GET /v1/entitlements. 한도·계량기 사용량은 Access 원장이 계산하고, Access가 의존할 수 없는 응원·찌르기
 * 일간 사용량은 /me처럼 여기서 Social 읽기 포트로 모아 넘긴다.
 */
export class GetEntitlementSnapshot {
  readonly #dependencies: GetEntitlementSnapshotDependencies;

  constructor(dependencies: GetEntitlementSnapshotDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetEntitlementSnapshotInput): Promise<EntitlementSnapshot> {
    const { quotaLedger, cheerUsageReader, nudgeUsageReader } = this.#dependencies;
    const [cheer, nudge] = await Promise.all([
      cheerUsageReader.readDailyUsage(input.userId, input.timezone),
      nudgeUsageReader.readDailyUsage(input.userId, input.timezone),
    ]);
    return quotaLedger.readSnapshot(input.userId, { CHEER: cheer, NUDGE: nudge });
  }
}
