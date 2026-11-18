import { ErrorCode } from "@aido/api/errors";

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

  it("같은 마지막 사용자의 페이지를 다시 기록하면 수를 더하지 않고 false다", () => {
    // Given
    const campaign = createBroadcastCampaignFixture({
      status: "FANNING_OUT",
      startedAt: NOW,
      cursorUserId: "user-500",
      processedCount: 500,
      queuedCount: 500,
    });

    // When
    const recorded = campaign.recordPage(
      { lastUserId: UserId.reconstitute("user-500"), processedCount: 500, queuedCount: 500 },
      NOW,
    );

    // Then
    expect(recorded).toBe(false);
    expect(campaign.toPrimitives()).toMatchObject({ processedCount: 500, queuedCount: 500 });
  });

  it("분배를 시작하지 않은 캠페인에는 페이지를 기록하지 않는다", () => {
    // Given
    const campaign = createBroadcastCampaignFixture();

    // When
    const recordPage = () =>
      campaign.recordPage(
        { lastUserId: UserId.reconstitute("user-1"), processedCount: 1, queuedCount: 1 },
        NOW,
      );

    // Then
    expect(recordPage).toThrow();
  });

  it("이미 그 상태인 캠페인에 같은 전이를 다시 요청하면 바꾸지 않고 false다", () => {
    // Given
    const fanningOut = createBroadcastCampaignFixture({ status: "FANNING_OUT", startedAt: NOW });
    const completed = createBroadcastCampaignFixture({ status: "COMPLETED", completedAt: NOW });
    const failed = createBroadcastCampaignFixture({ status: "FAILED", completedAt: NOW });

    // When
    const startedAgain = fanningOut.start(NOW);
    const completedAgain = completed.complete(NOW);
    const failedAgain = failed.fail("late", NOW);

    // Then
    expect(startedAgain).toBe(false);
    expect(completedAgain).toBe(false);
    expect(failedAgain).toBe(false);
    expect([fanningOut.status, completed.status, failed.status]).toEqual([
      "FANNING_OUT",
      "COMPLETED",
      "FAILED",
    ]);
  });

  it("끝난 캠페인을 다른 상태로 바꾸려 하면 오류다", () => {
    // Given
    const completed = createBroadcastCampaignFixture({ status: "COMPLETED", completedAt: NOW });
    const failed = createBroadcastCampaignFixture({ status: "FAILED", completedAt: NOW });
    const finished = expect.objectContaining({ errorCode: ErrorCode.SYS_0002 });

    // When
    const startCompleted = () => completed.start(NOW);
    const failCompleted = () => completed.fail("late", NOW);
    const startFailed = () => failed.start(NOW);
    const completeFailed = () => failed.complete(NOW);

    // Then
    expect(startCompleted).toThrow(finished);
    expect(failCompleted).toThrow(finished);
    expect(startFailed).toThrow(finished);
    expect(completeFailed).toThrow(finished);
    expect([completed.status, failed.status]).toEqual(["COMPLETED", "FAILED"]);
  });

  it("같은 요청 ID의 재요청이 처음과 같은 내용인지 비교한다", () => {
    // Given
    const campaign = createBroadcastCampaignFixture({
      action: { type: "DEEP_LINK", url: "/feed" },
    });
    const same = createBroadcastCampaignFixture({ action: { type: "DEEP_LINK", url: "/feed" } });

    // When
    const sameContent = campaign.isSameRequest(same);
    const differentBody = campaign.isSameRequest(
      createBroadcastCampaignFixture({
        action: { type: "DEEP_LINK", url: "/feed" },
        body: "다른 본문",
      }),
    );
    const differentAction = campaign.isSameRequest(
      createBroadcastCampaignFixture({ action: null }),
    );

    // Then
    expect(sameContent).toBe(true);
    expect(differentBody).toBe(false);
    expect(differentAction).toBe(false);
  });

  it("언어별 문구나 발송 시점이 다르면 다른 요청으로 본다", () => {
    // Given
    const campaign = createBroadcastCampaignFixture();

    // When
    const differentLocalizedContent = campaign.isSameRequest(
      createBroadcastCampaignFixture({
        localizedContent: { en: { title: "New feature", body: "Check it out." } },
      }),
    );
    const differentDelivery = campaign.isSameRequest(
      createBroadcastCampaignFixture({
        delivery: { mode: "RECIPIENT_LOCAL_TIME", localTime: "10:00", date: "2026-11-04" },
      }),
    );

    // Then
    expect(differentLocalizedContent).toBe(false);
    expect(differentDelivery).toBe(false);
  });
});

describe("BroadcastCampaign.contentFor — 수신자 언어별 문구", () => {
  it("언어별 문구가 있으면 그 문구를, 없는 언어는 기본 제목·본문을 쓴다", () => {
    // Given
    const campaign = createBroadcastCampaignFixture({
      localizedContent: { en: { title: "New feature", body: "Check it out." } },
    });

    // When
    const english = campaign.contentFor("en");
    const korean = campaign.contentFor("ko");

    // Then
    expect(english.value).toEqual({
      title: "New feature",
      body: "Check it out.",
    });
    expect(korean.value).toEqual({
      title: "새 기능 안내",
      body: "지금 확인해 보세요.",
    });
  });
});
