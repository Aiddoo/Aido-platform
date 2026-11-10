import {
  BroadcastCampaign,
  type BroadcastCampaignPrimitives,
} from "#api/modules/operations/broadcasts/domain/broadcast-campaign.aggregate";

export const BROADCAST_FIXTURE_NOW = Temporal.Instant.from("2026-11-03T10:00:00Z");
export const BROADCAST_FIXTURE_REQUEST_ID = "0f8b8a52-5b0e-4f39-9f8b-6f3b3c1f2a10";
export const BROADCAST_FIXTURE_CAMPAIGN_ID = "c0000000000000000000000c1";

/** 브로드캐스트 캠페인 기본값. 시나리오는 다른 필드만 덮어쓴다. */
export function createBroadcastCampaignFixture(
  overrides: Partial<BroadcastCampaignPrimitives> = {},
): BroadcastCampaign {
  return BroadcastCampaign.reconstitute({
    id: BROADCAST_FIXTURE_CAMPAIGN_ID,
    requestId: BROADCAST_FIXTURE_REQUEST_ID,
    title: "새 기능 안내",
    body: "지금 확인해 보세요.",
    localizedContent: null,
    targetFilter: "ALL",
    action: null,
    force: false,
    delivery: { mode: "NOW" },
    status: "QUEUED",
    cursorUserId: null,
    processedCount: 0,
    queuedCount: 0,
    failureReason: null,
    createdAt: BROADCAST_FIXTURE_NOW,
    updatedAt: BROADCAST_FIXTURE_NOW,
    startedAt: null,
    completedAt: null,
    ...overrides,
  });
}
