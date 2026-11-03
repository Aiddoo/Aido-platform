import { ErrorCode } from "@aido/api/errors";

import { broadcastCampaignFixture } from "#test/fixtures/index";

import type { BroadcastCampaignCreationPlan } from "../../../domain/aggregates/admin/broadcast-campaign.aggregate.js";
import { CreateBroadcastCampaign } from "./create-broadcast-campaign.use-case.js";

const REQUEST_ID = "0f8b8a52-5b0e-4f39-9f8b-6f3b3c1f2a10";

function setup(options: {
  existing?: ReturnType<typeof broadcastCampaignFixture>;
  targets?: number;
}) {
  const enqueued: Array<{ campaignId: string; cursorUserId: string | null }> = [];
  const created: BroadcastCampaignCreationPlan[] = [];
  const useCase = new CreateBroadcastCampaign({
    repository: {
      createOrFind: async (plan) => {
        if (options.existing != null) {
          return { campaign: options.existing, created: false };
        }
        created.push(plan);
        return { campaign: broadcastCampaignFixture({ ...plan, id: "c-new" }), created: true };
      },
    },
    userDirectory: { countTargets: async () => options.targets ?? 3 },
    fanOutEnqueuer: {
      enqueueFanOut: async (input) => {
        enqueued.push({ ...input });
      },
    },
    unitOfWork: { run: (work) => work() },
    logger: { log: () => undefined },
  });
  return { useCase, enqueued, created };
}

const input = {
  requestId: REQUEST_ID,
  title: "새 기능 안내",
  body: "지금 확인해 보세요.",
  targetFilter: "ALL",
  action: undefined,
  force: false,
} as const;

describe("CreateBroadcastCampaign — 브로드캐스트 접수", () => {
  it("새 요청은 캠페인을 만들고 첫 분배 작업을 같은 transaction에 등록한다", async () => {
    // Given
    const { useCase, enqueued, created } = setup({ targets: 1200 });

    // When
    const result = await useCase.execute(input);

    // Then
    expect(created).toHaveLength(1);
    expect(enqueued).toEqual([{ campaignId: "c-new", cursorUserId: null }]);
    expect(result).toMatchObject({ targetCount: 1200, campaign: { status: "QUEUED" } });
  });

  it("같은 요청 ID의 같은 재요청은 새로 분배하지 않고 처음 캠페인을 돌려준다", async () => {
    // Given
    const existing = broadcastCampaignFixture({ status: "FANNING_OUT" });
    const { useCase, enqueued } = setup({ existing });

    // When
    const result = await useCase.execute(input);

    // Then
    expect(enqueued).toHaveLength(0);
    expect(result.campaign).toBe(existing);
  });

  it("같은 요청 ID로 다른 내용을 보내면 409로 거절한다", async () => {
    // Given
    const { useCase, enqueued } = setup({ existing: broadcastCampaignFixture() });

    // When / Then
    await expect(useCase.execute({ ...input, body: "바뀐 본문" })).rejects.toMatchObject({
      errorCode: ErrorCode.ADMIN_1405,
    });
    expect(enqueued).toHaveLength(0);
  });

  it("대상이 없으면 캠페인을 남기지 않도록 404로 거절한다", async () => {
    // Given
    const { useCase, enqueued } = setup({ targets: 0 });

    // When / Then
    await expect(useCase.execute(input)).rejects.toMatchObject({ errorCode: ErrorCode.ADMIN_1402 });
    expect(enqueued).toHaveLength(0);
  });
});
