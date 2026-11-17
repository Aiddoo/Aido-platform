import { InMemoryBroadcastCampaignRepository } from "#test/doubles/operations/in-memory-broadcast-campaign.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  BROADCAST_FIXTURE_CAMPAIGN_ID,
  BROADCAST_FIXTURE_NOW,
  createBroadcastCampaignFixture,
} from "#test/fixtures/operations/broadcast-campaign.fixture";

import { BroadcastCampaignId } from "../../domain/broadcast-campaign-id.vo.js";
import type { BroadcastCampaign } from "../../domain/broadcast-campaign.aggregate.js";
import { FailBroadcastCampaignUseCase } from "./fail-broadcast-campaign.use-case.js";

const NOW = BROADCAST_FIXTURE_NOW.add({ minutes: 10 });
const campaignId = BroadcastCampaignId.reconstitute(BROADCAST_FIXTURE_CAMPAIGN_ID);

function setup(campaign: BroadcastCampaign) {
  const campaignRepository = new InMemoryBroadcastCampaignRepository([campaign]);
  const useCase = new FailBroadcastCampaignUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    campaignRepository,
    clock: new FixedClock(NOW),
    logger: new SilentLogger(),
  });
  return { campaignRepository, useCase };
}

describe("FailBroadcastCampaignUseCase — 분배 재시도 소진", () => {
  it("분배 중인 캠페인을 실패로 닫고 저장한다", async () => {
    // Given
    const { campaignRepository, useCase } = setup(
      createBroadcastCampaignFixture({ status: "FANNING_OUT", startedAt: BROADCAST_FIXTURE_NOW }),
    );

    // When
    const failed = await useCase.execute({ campaignId });

    // Then
    expect(failed).toBe(true);
    expect((await campaignRepository.findById(campaignId))?.toPrimitives()).toMatchObject({
      status: "FAILED",
      failureReason: "FAN_OUT_RETRIES_EXHAUSTED",
      completedAt: NOW,
    });
  });

  it.each(["COMPLETED", "FAILED"] as const)(
    "이미 %s인 캠페인은 바꾸지 않고 false다",
    async (status) => {
      // Given
      const { campaignRepository, useCase } = setup(
        createBroadcastCampaignFixture({ status, completedAt: BROADCAST_FIXTURE_NOW }),
      );

      // When
      const failed = await useCase.execute({ campaignId });

      // Then
      expect(failed).toBe(false);
      expect((await campaignRepository.findById(campaignId))?.toPrimitives()).toMatchObject({
        status,
        completedAt: BROADCAST_FIXTURE_NOW,
      });
    },
  );
});
