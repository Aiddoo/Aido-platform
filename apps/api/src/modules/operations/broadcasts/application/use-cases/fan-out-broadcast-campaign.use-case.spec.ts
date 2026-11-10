import { broadcastCampaignFixture } from "#test/fixtures/index";

import type { BroadcastCampaign } from "../../domain/broadcast-campaign.aggregate.js";
import { BROADCAST_FAN_OUT_POLICY } from "../../domain/broadcasts.constants.js";
import type { AdminBroadcastMessage } from "../read-models/broadcast-message.read-model.js";
import { FanOutBroadcastCampaign } from "./fan-out-broadcast-campaign.use-case.js";

type CampaignStore = ConstructorParameters<typeof FanOutBroadcastCampaign>[0]["repository"];

function userIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `user-${String(index).padStart(5, "0")}`);
}

/** 커밋된 상태만 남기는 저장소 대역. 페이지 중간 실패는 마지막 커밋 상태로 돌아간다. */
class InMemoryCampaignStore implements CampaignStore {
  committed: BroadcastCampaign;

  constructor(campaign: BroadcastCampaign) {
    this.committed = campaign;
  }

  async findByIdForUpdate(): Promise<BroadcastCampaign> {
    return broadcastCampaignFixture(this.committed.toSnapshot());
  }

  async save(campaign: BroadcastCampaign): Promise<void> {
    this.committed = broadcastCampaignFixture(campaign.toSnapshot());
  }
}

function setup(options: {
  readonly audience: readonly string[];
  readonly campaign?: BroadcastCampaign;
  readonly failOnPage?: number;
}) {
  const store = new InMemoryCampaignStore(options.campaign ?? broadcastCampaignFixture());
  const sentPages: AdminBroadcastMessage[][] = [];
  const continuations: Array<{ campaignId: string; cursorUserId: string | null }> = [];
  let page = 0;
  const useCase = new FanOutBroadcastCampaign({
    repository: store,
    userDirectory: {
      findTargetUserIdsAfter: async (_filter, cursor, limit) =>
        options.audience.filter((id) => cursor == null || id > cursor).slice(0, limit),
    },
    notifier: {
      sendBatch: async (messages) => {
        page += 1;
        if (page === options.failOnPage) {
          throw new Error("worker crashed");
        }
        sentPages.push(messages);
        return { count: messages.length };
      },
    },
    fanOutEnqueuer: {
      enqueueFanOut: async (input) => {
        continuations.push({ ...input });
      },
    },
    unitOfWork: { run: (work) => work() },
    logger: { log: () => undefined },
  });
  return { useCase, store, sentPages, continuations };
}

describe("FanOutBroadcastCampaign — 대상 분배", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("대상을 페이지로 나눠 캠페인 키가 붙은 알림을 만들고 끝나면 완료한다", async () => {
    // Given
    const audience = userIds(BROADCAST_FAN_OUT_POLICY.pageSize * 2 + 1);
    const { useCase, store, sentPages } = setup({ audience });

    // When
    await useCase.execute({ campaignId: store.committed.id });

    // Then
    expect(sentPages.map((messages) => messages.length)).toEqual([
      BROADCAST_FAN_OUT_POLICY.pageSize,
      BROADCAST_FAN_OUT_POLICY.pageSize,
      1,
    ]);
    expect(sentPages[0]?.[0]).toMatchObject({
      type: "ADMIN_BROADCAST",
      campaignKey: store.committed.campaignKey,
    });
    expect(store.committed.toSnapshot()).toMatchObject({
      status: "COMPLETED",
      processedCount: audience.length,
      queuedCount: audience.length,
    });
  });

  it("작업이 페이지 중간에 죽으면 다음 실행이 커밋된 cursor부터 이어 가 같은 사용자를 두 번 보내지 않는다", async () => {
    // Given
    const audience = userIds(BROADCAST_FAN_OUT_POLICY.pageSize * 2);
    const crashed = setup({ audience, failOnPage: 2 });
    await expect(
      crashed.useCase.execute({ campaignId: crashed.store.committed.id }),
    ).rejects.toThrow("worker crashed");
    const resumed = setup({ audience, campaign: crashed.store.committed });

    // When
    await resumed.useCase.execute({ campaignId: resumed.store.committed.id });

    // Then
    const delivered = [...crashed.sentPages, ...resumed.sentPages].flat().map((m) => m.userId);
    expect(delivered).toEqual(audience);
    expect(resumed.store.committed.status).toBe("COMPLETED");
  });

  it("실행 예산을 넘기면 다음 cursor 작업을 남기고 멈춘다", async () => {
    // Given
    vi.useFakeTimers({ toFake: ["Date"] });
    const audience = userIds(BROADCAST_FAN_OUT_POLICY.pageSize * 3);
    const { useCase, store, sentPages, continuations } = setup({ audience });
    vi.setSystemTime(new Date("2026-11-03T10:00:00.000Z"));

    // When: 첫 페이지 처리 중 예산을 다 쓴다
    const run = useCase.execute({ campaignId: store.committed.id });
    vi.setSystemTime(Date.now() + BROADCAST_FAN_OUT_POLICY.runBudgetMs);
    await run;

    // Then
    expect(sentPages).toHaveLength(1);
    expect(continuations).toEqual([
      {
        campaignId: store.committed.id,
        cursorUserId: audience[BROADCAST_FAN_OUT_POLICY.pageSize - 1],
      },
    ]);
    expect(store.committed.status).toBe("FANNING_OUT");
  });

  it("대상이 없거나 이미 끝난 캠페인은 알림 없이 끝낸다", async () => {
    // Given
    const empty = setup({ audience: [] });
    const finished = setup({
      audience: userIds(3),
      campaign: broadcastCampaignFixture({ status: "FAILED" }),
    });

    // When
    await empty.useCase.execute({ campaignId: empty.store.committed.id });
    await finished.useCase.execute({ campaignId: finished.store.committed.id });

    // Then
    expect(empty.sentPages).toHaveLength(0);
    expect(empty.store.committed.status).toBe("COMPLETED");
    expect(finished.sentPages).toHaveLength(0);
    expect(finished.store.committed.status).toBe("FAILED");
  });
});
