import type { BroadcastResult } from "@aido/api";

import type {
  CreateBroadcastCampaignUseCase,
  CreateBroadcastCampaignInput,
} from "./create-broadcast-campaign.use-case.js";

interface BroadcastNotificationDependencies {
  readonly createBroadcastCampaign: Pick<CreateBroadcastCampaignUseCase, "execute">;
}

/**
 * @deprecated v1 응답 계약을 위한 진입점이다. 분배는 v2와 같은 캠페인 작업으로 진행되고, 결과 수는
 * 접수 시점에 대기열에 올릴 대상 수다.
 * TODO: 관리자 도구가 v2 캠페인 API로 옮긴 뒤 v1 broadcast route와 함께 지운다.
 */
export class BroadcastNotificationUseCase {
  readonly #dependencies: BroadcastNotificationDependencies;

  constructor(dependencies: BroadcastNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: CreateBroadcastCampaignInput): Promise<BroadcastResult> {
    const { targetCount } = await this.#dependencies.createBroadcastCampaign.execute(input);
    return { successCount: targetCount, failCount: 0, totalTargets: targetCount };
  }
}
