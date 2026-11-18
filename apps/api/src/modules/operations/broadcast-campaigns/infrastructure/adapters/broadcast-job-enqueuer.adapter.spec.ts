import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";

import { BroadcastCampaignId } from "../../domain/broadcast-campaign-id.vo.js";
import { BROADCAST_DELIVERY_QUEUE } from "../jobs/broadcast-delivery.queue.js";
import { BroadcastJobEnqueuerAdapter } from "./broadcast-job-enqueuer.adapter.js";

const SEOUL_AT = Temporal.Instant.from("2026-11-04T01:00:00Z");
const LA_AT = Temporal.Instant.from("2026-11-04T18:00:00Z");

describe("BroadcastJobEnqueuerAdapter — 현지 시각 발송 작업 묶음 등록", () => {
  it("묶음마다 기존과 같은 payload·job key·시각으로 등록하고 빈 묶음은 건너뛴다", async () => {
    // Given
    const jobQueue = new InMemoryJobQueue();
    const adapter = new BroadcastJobEnqueuerAdapter(jobQueue);

    // When
    await adapter.enqueueDeliveries(BroadcastCampaignId.reconstitute("campaign-1"), [
      {
        startAfter: SEOUL_AT,
        userIds: [UserId.reconstitute("user-1"), UserId.reconstitute("user-2")],
      },
      { startAfter: LA_AT, userIds: [UserId.reconstitute("user-3")] },
      { startAfter: LA_AT, userIds: [] },
    ]);

    // Then
    expect(jobQueue.jobsIn(BROADCAST_DELIVERY_QUEUE)).toEqual([
      {
        queue: BROADCAST_DELIVERY_QUEUE.name,
        payload: {
          name: "deliver-group",
          data: { campaignId: "campaign-1", userIds: ["user-1", "user-2"] },
        },
        options: {
          idempotencyKey: "broadcast-delivery-campaign-1-2026-11-04T01:00:00Z-user-1",
          startAfter: SEOUL_AT,
          priority: 0,
        },
      },
      {
        queue: BROADCAST_DELIVERY_QUEUE.name,
        payload: { name: "deliver-group", data: { campaignId: "campaign-1", userIds: ["user-3"] } },
        options: {
          idempotencyKey: "broadcast-delivery-campaign-1-2026-11-04T18:00:00Z-user-3",
          startAfter: LA_AT,
          priority: 0,
        },
      },
    ]);
  });
});
