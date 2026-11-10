import { broadcastCampaignFixture } from "#test/fixtures/index";

describe("BroadcastCampaign — 브로드캐스트 분배 진행", () => {
  const now = new Date("2026-11-03T10:05:00.000Z");

  it("페이지를 기록할 때마다 cursor를 옮기고 처리 수를 더한다", () => {
    // Given
    const campaign = broadcastCampaignFixture();

    // When
    campaign.start(now);
    campaign.recordPage({ lastUserId: "user-500", processedCount: 500, queuedCount: 498 });
    campaign.recordPage({ lastUserId: "user-700", processedCount: 200, queuedCount: 200 });

    // Then
    expect(campaign.toSnapshot()).toMatchObject({
      status: "FANNING_OUT",
      cursorUserId: "user-700",
      processedCount: 700,
      queuedCount: 698,
      startedAt: now,
    });
  });

  it("분배를 시작하지 않은 캠페인에는 페이지를 기록하지 않는다", () => {
    // Given
    const campaign = broadcastCampaignFixture();

    // When / Then
    expect(() =>
      campaign.recordPage({ lastUserId: "user-1", processedCount: 1, queuedCount: 1 }),
    ).toThrow();
  });

  it("끝난 캠페인은 다시 시작·완료·실패로 바뀌지 않는다", () => {
    // Given
    const campaign = broadcastCampaignFixture({ status: "COMPLETED", completedAt: now });

    // When / Then
    expect(campaign.start(now)).toBe(false);
    expect(campaign.complete(now)).toBe(false);
    expect(campaign.fail("late", now)).toBe(false);
    expect(campaign.status).toBe("COMPLETED");
  });

  it("같은 요청 ID의 재요청이 처음과 같은 내용인지 비교한다", () => {
    // Given
    const campaign = broadcastCampaignFixture({ action: { type: "DEEP_LINK", url: "/feed" } });
    const sameRequest = {
      title: campaign.title,
      body: campaign.body,
      targetFilter: campaign.targetFilter,
      action: { type: "DEEP_LINK", url: "/feed" },
      force: false,
    } as const;

    // When / Then
    expect(campaign.isSameRequest(sameRequest)).toBe(true);
    expect(campaign.isSameRequest({ ...sameRequest, body: "다른 본문" })).toBe(false);
    expect(campaign.isSameRequest({ ...sameRequest, action: null })).toBe(false);
  });
});
