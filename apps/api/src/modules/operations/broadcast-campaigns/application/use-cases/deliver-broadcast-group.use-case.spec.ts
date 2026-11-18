import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { InMemoryBroadcastCampaignRepository } from "#test/doubles/operations/in-memory-broadcast-campaign.repository";
import { RecordingAdminBroadcastNotifier } from "#test/doubles/operations/recording-admin-broadcast-notifier";
import { StubBroadcastRecipientReader } from "#test/doubles/operations/stub-broadcast-recipient.reader";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  BROADCAST_FIXTURE_CAMPAIGN_ID,
  createBroadcastCampaignFixture,
} from "#test/fixtures/operations/broadcast-campaign.fixture";

import { BroadcastCampaignId } from "../../domain/broadcast-campaign-id.vo.js";
import { DeliverBroadcastGroupUseCase } from "./deliver-broadcast-group.use-case.js";

function setup(campaigns = [createBroadcastCampaignFixture({ status: "COMPLETED" })]) {
  const notifier = new RecordingAdminBroadcastNotifier();
  const unitOfWork = new ImmediateUnitOfWork();
  const useCase = new DeliverBroadcastGroupUseCase({
    unitOfWork,
    campaignRepository: new InMemoryBroadcastCampaignRepository(campaigns),
    recipientReader: new StubBroadcastRecipientReader({ "user-en": { locale: "en" } }),
    notifier,
    logger: new SilentLogger(),
  });
  return { useCase, notifier, unitOfWork };
}

const campaignId = BroadcastCampaignId.reconstitute(BROADCAST_FIXTURE_CAMPAIGN_ID);

describe("DeliverBroadcastGroupUseCase — 현지 시각이 된 묶음의 알림 만들기", () => {
  it("묶음의 사용자에게 수신자 언어 문구로 캠페인 키가 붙은 알림을 한 transaction에 만든다", async () => {
    // Given
    const { useCase, notifier, unitOfWork } = setup([
      createBroadcastCampaignFixture({
        status: "COMPLETED",
        localizedContent: { en: { title: "New feature", body: "Check it out." } },
      }),
    ]);

    // When
    await useCase.execute({
      campaignId,
      userIds: [UserId.reconstitute("user-en"), UserId.reconstitute("user-ko")],
    });

    // Then
    expect(unitOfWork.runCount).toBe(1);
    expect(notifier.messages.map(({ userId, title }) => ({ userId, title }))).toEqual([
      { userId: "user-en", title: "New feature" },
      { userId: "user-ko", title: "새 기능 안내" },
    ]);
    expect(notifier.messages[0]).toMatchObject({
      type: "ADMIN_BROADCAST",
      campaignKey: `admin-broadcast:${BROADCAST_FIXTURE_CAMPAIGN_ID}`,
    });
  });

  it("캠페인이 없으면 알림 없이 건너뛴다", async () => {
    // Given
    const { useCase, notifier } = setup([]);

    // When
    await useCase.execute({ campaignId, userIds: [UserId.reconstitute("user-ko")] });

    // Then
    expect(notifier.batches).toEqual([]);
  });
});
