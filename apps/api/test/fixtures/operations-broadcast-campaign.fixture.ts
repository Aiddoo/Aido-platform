import {
  BroadcastCampaign,
  type BroadcastCampaignProps,
} from "#api/modules/operations/domain/aggregates/admin/broadcast-campaign.aggregate";

/** 브로드캐스트 캠페인 기본값. 시나리오는 다른 필드만 덮어쓴다. */
export function broadcastCampaignFixture(
  overrides: Partial<BroadcastCampaignProps> = {},
): BroadcastCampaign {
  return BroadcastCampaign.reconstitute({
    id: "c0000000000000000000000c1",
    requestId: "0f8b8a52-5b0e-4f39-9f8b-6f3b3c1f2a10",
    status: "QUEUED",
    title: "새 기능 안내",
    body: "지금 확인해 보세요.",
    targetFilter: "ALL",
    action: null,
    force: false,
    cursorUserId: null,
    processedCount: 0,
    queuedCount: 0,
    failureReason: null,
    createdAt: new Date("2026-11-03T10:00:00.000Z"),
    startedAt: null,
    completedAt: null,
    ...overrides,
  });
}
