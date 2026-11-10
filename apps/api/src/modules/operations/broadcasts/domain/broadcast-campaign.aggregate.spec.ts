import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  BROADCAST_FIXTURE_NOW,
  createBroadcastCampaignFixture,
} from "#test/fixtures/operations/broadcast-campaign.fixture";

const NOW = BROADCAST_FIXTURE_NOW.add({ minutes: 5 });

describe("BroadcastCampaign — 브로드캐스트 분배 진행", () => {
  it("페이지를 기록할 때마다 cursor를 옮기고 처리 수를 더한다", () => {
    // Given
    const campaign = createBroadcastCampaignFixture();

    // When
    campaign.start(NOW);
    campaign.recordPage(
      { lastUserId: UserId.reconstitute("user-500"), processedCount: 500, queuedCount: 498 },
      NOW,
    );
    campaign.recordPage(
      { lastUserId: UserId.reconstitute("user-700"), processedCount: 200, queuedCount: 200 },
      NOW,
    );

    // Then
    expect(campaign.toPrimitives()).toMatchObject({
      status: "FANNING_OUT",
      cursorUserId: "user-700",
      processedCount: 700,
      queuedCount: 698,
      startedAt: NOW,
      updatedAt: NOW,
    });
  });

  it("분배를 시작하지 않은 캠페인에는 페이지를 기록하지 않는다", () => {
    // Given
    const campaign = createBroadcastCampaignFixture();

    // Then
    expect(() =>
      campaign.recordPage(
        { lastUserId: UserId.reconstitute("user-1"), processedCount: 1, queuedCount: 1 },
        NOW,
      ),
    ).toThrow();
  });

  it("끝난 캠페인은 다시 시작·완료·실패로 바뀌지 않는다", () => {
    // Given
    const campaign = createBroadcastCampaignFixture({ status: "COMPLETED", completedAt: NOW });

    // Then
    expect(campaign.start(NOW)).toBe(false);
    expect(campaign.complete(NOW)).toBe(false);
    expect(campaign.fail("late", NOW)).toBe(false);
    expect(campaign.status).toBe("COMPLETED");
  });

  it("같은 요청 ID의 재요청이 처음과 같은 내용인지 비교한다", () => {
    // Given
    const campaign = createBroadcastCampaignFixture({
      action: { type: "DEEP_LINK", url: "/feed" },
    });
    const same = createBroadcastCampaignFixture({ action: { type: "DEEP_LINK", url: "/feed" } });

    // Then
    expect(campaign.isSameRequest(same)).toBe(true);
    expect(
      campaign.isSameRequest(
        createBroadcastCampaignFixture({
          action: { type: "DEEP_LINK", url: "/feed" },
          body: "다른 본문",
        }),
      ),
    ).toBe(false);
    expect(campaign.isSameRequest(createBroadcastCampaignFixture({ action: null }))).toBe(false);
  });

  it("언어별 문구나 발송 시점이 다르면 다른 요청으로 본다", () => {
    // Given
    const campaign = createBroadcastCampaignFixture();

    // Then
    expect(
      campaign.isSameRequest(
        createBroadcastCampaignFixture({
          localizedContent: { en: { title: "New feature", body: "Check it out." } },
        }),
      ),
    ).toBe(false);
    expect(
      campaign.isSameRequest(
        createBroadcastCampaignFixture({
          delivery: { mode: "RECIPIENT_LOCAL_TIME", localTime: "10:00", date: "2026-11-04" },
        }),
      ),
    ).toBe(false);
  });
});

describe("BroadcastCampaign.contentFor — 수신자 언어별 문구", () => {
  it("언어별 문구가 있으면 그 문구를, 없는 언어는 기본 제목·본문을 쓴다", () => {
    // Given
    const campaign = createBroadcastCampaignFixture({
      localizedContent: { en: { title: "New feature", body: "Check it out." } },
    });

    // Then
    expect(campaign.contentFor("en").value).toEqual({
      title: "New feature",
      body: "Check it out.",
    });
    expect(campaign.contentFor("ko").value).toEqual({
      title: "새 기능 안내",
      body: "지금 확인해 보세요.",
    });
  });
});
