import type { BroadcastCampaignRepositoryPort } from "#api/modules/operations/broadcasts/application/ports/broadcast-campaign.repository.port";
import type { BroadcastCampaignPrimitives } from "#api/modules/operations/broadcasts/domain/broadcast-campaign.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  BROADCAST_FIXTURE_NOW,
  createBroadcastCampaignFixture,
} from "#test/fixtures/operations/broadcast-campaign.fixture";

const LATER = BROADCAST_FIXTURE_NOW.add({ minutes: 5 });
const OTHER_REQUEST_ID = "7d3a3f6e-3a0c-4b8e-9d0f-0d6a3c2b1a90";

async function createCampaign(
  repository: BroadcastCampaignRepositoryPort,
  overrides: Partial<BroadcastCampaignPrimitives> = {},
) {
  const id = await repository.nextId();
  return createBroadcastCampaignFixture({ id: id.value, ...overrides });
}

export function describeBroadcastCampaignRepositoryContract(
  createRepository: () => Promise<BroadcastCampaignRepositoryPort>,
): void {
  describe("브로드캐스트 캠페인 저장소 계약", () => {
    it("nextId는 부를 때마다 다른 id를 준다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const ids = [await repository.nextId(), await repository.nextId()];

      // Then
      expect(ids[0]?.equals(ids[1] ?? ids[0])).toBe(false);
    });

    it("새 요청 ID는 캠페인을 만들고 언어별 문구와 발송 시점까지 그대로 읽는다", async () => {
      // Given
      const repository = await createRepository();
      const campaign = await createCampaign(repository, {
        localizedContent: { en: { title: "New feature", body: "Check it out." } },
        delivery: { mode: "RECIPIENT_LOCAL_TIME", localTime: "10:00", date: "2026-11-11" },
        action: { type: "DEEP_LINK", url: "/feed" },
        force: true,
      });

      // When
      const result = await repository.acceptByRequestId(campaign);
      const found = await repository.findById(campaign.id);

      // Then
      expect(result.created).toBe(true);
      expect(result.campaign.toPrimitives()).toEqual(campaign.toPrimitives());
      expect(found?.toPrimitives()).toEqual(campaign.toPrimitives());
    });

    it("기능 전에 접수한 모양(언어별 문구·발송 시점 없음)은 지금 발송으로 읽는다", async () => {
      // Given
      const repository = await createRepository();
      const campaign = await createCampaign(repository);

      // When
      await repository.acceptByRequestId(campaign);
      const found = await repository.findById(campaign.id);

      // Then
      expect(found?.toPrimitives()).toMatchObject({
        localizedContent: null,
        delivery: { mode: "NOW" },
      });
    });

    it("같은 요청 ID는 새로 만들지 않고 처음 접수한 캠페인을 돌려준다", async () => {
      // Given
      const repository = await createRepository();
      const first = await createCampaign(repository);
      await repository.acceptByRequestId(first);
      const replay = await createCampaign(repository, { body: "바뀐 본문" });

      // When
      const result = await repository.acceptByRequestId(replay);

      // Then
      expect(result.created).toBe(false);
      expect(result.campaign.id.equals(first.id)).toBe(true);
      expect(result.campaign.toPrimitives().body).toBe("지금 확인해 보세요.");
      expect(await repository.findById(replay.id)).toBeNull();
    });

    it("없는 캠페인은 null이다", async () => {
      // Given
      const repository = await createRepository();
      const missing = await repository.nextId();

      // Then
      expect(await repository.findById(missing)).toBeNull();
      expect(await repository.findByIdForUpdate(missing)).toBeNull();
    });

    it("진행 상태를 저장하면 같은 캠페인을 다음에 이어서 읽는다", async () => {
      // Given
      const repository = await createRepository();
      const created = await createCampaign(repository);
      await repository.acceptByRequestId(created);
      const campaign = await repository.findByIdForUpdate(created.id);
      campaign?.start(LATER);
      campaign?.recordPage(
        { lastUserId: UserId.reconstitute("user-500"), processedCount: 500, queuedCount: 498 },
        LATER,
      );
      campaign?.complete(LATER);

      // When
      if (campaign != null) {
        await repository.save(campaign);
      }
      const found = await repository.findById(created.id);

      // Then
      expect(found?.toPrimitives()).toMatchObject({
        status: "COMPLETED",
        cursorUserId: "user-500",
        processedCount: 500,
        queuedCount: 498,
        startedAt: LATER,
        completedAt: LATER,
        updatedAt: LATER,
        requestId: created.requestId,
      });
    });

    it("다른 요청 ID는 별개 캠페인이다", async () => {
      // Given
      const repository = await createRepository();
      await repository.acceptByRequestId(await createCampaign(repository));

      // When
      const second = await repository.acceptByRequestId(
        await createCampaign(repository, { requestId: OTHER_REQUEST_ID }),
      );

      // Then
      expect(second.created).toBe(true);
    });
  });
}
