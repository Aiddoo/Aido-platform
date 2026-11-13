import { InMemoryAdminUserDirectoryReader } from "#test/doubles/operations/in-memory-admin-user-directory.reader";
import { InMemoryBroadcastCampaignRepository } from "#test/doubles/operations/in-memory-broadcast-campaign.repository";
import { RecordingAdminBroadcastNotifier } from "#test/doubles/operations/recording-admin-broadcast-notifier";
import { RecordingBroadcastJobEnqueuer } from "#test/doubles/operations/recording-broadcast-job-enqueuer";
import { StubBroadcastRecipientReader } from "#test/doubles/operations/stub-broadcast-recipient.reader";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  BROADCAST_FIXTURE_NOW,
  createBroadcastCampaignFixture,
} from "#test/fixtures/operations/broadcast-campaign.fixture";

import { BroadcastCampaignId } from "../../domain/broadcast-campaign-id.vo.js";
import type { BroadcastCampaign } from "../../domain/broadcast-campaign.aggregate.js";
import {
  BROADCAST_FAN_OUT_PAGE_SIZE,
  BROADCAST_FAN_OUT_RUN_BUDGET_MS,
} from "../../domain/broadcasts.constants.js";
import type { AdminBroadcastMessage } from "../read-models/broadcast-message.read-model.js";
import { FanOutBroadcastCampaignUseCase } from "./fan-out-broadcast-campaign.use-case.js";

function userIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `user-${String(index).padStart(5, "0")}`);
}

// 첫 페이지를 처리하는 동안 실행 예산이 다 지난 것처럼 시계를 움직인다
class BudgetBurningNotifier extends RecordingAdminBroadcastNotifier {
  readonly #clock: FixedClock;

  constructor(clock: FixedClock) {
    super();
    this.#clock = clock;
  }

  override async sendBatch(messages: readonly AdminBroadcastMessage[]): Promise<{ count: number }> {
    this.#clock.advanceBy({ milliseconds: BROADCAST_FAN_OUT_RUN_BUDGET_MS });
    return super.sendBatch(messages);
  }
}

// 지정한 번째 배치에서 작업이 죽는 알림 대역
class CrashingNotifier extends RecordingAdminBroadcastNotifier {
  readonly #crashOnBatch: number;

  constructor(crashOnBatch: number) {
    super();
    this.#crashOnBatch = crashOnBatch;
  }

  override async sendBatch(messages: readonly AdminBroadcastMessage[]): Promise<{ count: number }> {
    if (this.batches.length + 1 === this.#crashOnBatch) {
      throw new Error("worker crashed");
    }
    return super.sendBatch(messages);
  }
}

function setup(options: {
  readonly audience: readonly string[];
  readonly campaign?: BroadcastCampaign;
  readonly campaignRepository?: InMemoryBroadcastCampaignRepository;
  readonly recipients?: StubBroadcastRecipientReader;
  readonly notifier?: (clock: FixedClock) => RecordingAdminBroadcastNotifier;
}) {
  const clock = new FixedClock(BROADCAST_FIXTURE_NOW);
  const campaign = options.campaign ?? createBroadcastCampaignFixture();
  const campaignRepository =
    options.campaignRepository ?? new InMemoryBroadcastCampaignRepository([campaign]);
  const notifier = options.notifier?.(clock) ?? new RecordingAdminBroadcastNotifier();
  const jobEnqueuer = new RecordingBroadcastJobEnqueuer();
  const useCase = new FanOutBroadcastCampaignUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    campaignRepository,
    userDirectory: new InMemoryAdminUserDirectoryReader(options.audience),
    recipientReader: options.recipients ?? new StubBroadcastRecipientReader(),
    notifier,
    jobEnqueuer,
    clock,
    logger: new SilentLogger(),
  });
  const campaignId = BroadcastCampaignId.reconstitute(campaign.id.value);
  const stored = async () => {
    const found = await campaignRepository.findById(campaignId);
    if (found == null) {
      throw new Error("campaign missing");
    }
    return found;
  };
  return { useCase, campaignId, campaignRepository, notifier, jobEnqueuer, stored };
}

describe("FanOutBroadcastCampaignUseCase — 대상 분배", () => {
  it("대상을 페이지로 나눠 캠페인 키가 붙은 알림을 만들고 끝나면 완료한다", async () => {
    // Given
    const audience = userIds(BROADCAST_FAN_OUT_PAGE_SIZE * 2 + 1);
    const { useCase, campaignId, notifier, stored } = setup({ audience });

    // When
    await useCase.execute({ campaignId });

    // Then
    expect(notifier.batches.map((messages) => messages.length)).toEqual([
      BROADCAST_FAN_OUT_PAGE_SIZE,
      BROADCAST_FAN_OUT_PAGE_SIZE,
      1,
    ]);
    expect(notifier.messages[0]).toMatchObject({
      type: "ADMIN_BROADCAST",
      campaignKey: (await stored()).campaignKey,
    });
    expect((await stored()).toPrimitives()).toMatchObject({
      status: "COMPLETED",
      processedCount: audience.length,
      queuedCount: audience.length,
    });
  });

  it("작업이 페이지 중간에 죽으면 다음 실행이 커밋된 cursor부터 이어 가 같은 사용자를 두 번 보내지 않는다", async () => {
    // Given
    const audience = userIds(BROADCAST_FAN_OUT_PAGE_SIZE * 2);
    const crashed = setup({ audience, notifier: () => new CrashingNotifier(2) });
    await expect(crashed.useCase.execute({ campaignId: crashed.campaignId })).rejects.toThrow(
      "worker crashed",
    );
    const resumed = setup({
      audience,
      campaign: createBroadcastCampaignFixture(),
      campaignRepository: crashed.campaignRepository,
    });

    // When
    await resumed.useCase.execute({ campaignId: resumed.campaignId });

    // Then
    const delivered = [...crashed.notifier.messages, ...resumed.notifier.messages].map(
      (message) => message.userId,
    );
    expect(delivered).toEqual(audience);
    expect((await resumed.stored()).status).toBe("COMPLETED");
  });

  it("실행 예산을 넘기면 다음 cursor 작업을 남기고 멈춘다", async () => {
    // Given
    const audience = userIds(BROADCAST_FAN_OUT_PAGE_SIZE * 3);
    const { useCase, campaignId, notifier, jobEnqueuer, stored } = setup({
      audience,
      notifier: (clock) => new BudgetBurningNotifier(clock),
    });

    // When
    await useCase.execute({ campaignId });

    // Then
    expect(notifier.batches).toHaveLength(1);
    expect(jobEnqueuer.fanOuts).toEqual([
      {
        campaignId: campaignId.value,
        cursorUserId: audience[BROADCAST_FAN_OUT_PAGE_SIZE - 1],
      },
    ]);
    expect((await stored()).status).toBe("FANNING_OUT");
  });

  it("대상이 없거나 이미 끝난 캠페인은 알림 없이 끝낸다", async () => {
    // Given
    const empty = setup({ audience: [] });
    const finished = setup({
      audience: userIds(3),
      campaign: createBroadcastCampaignFixture({ status: "FAILED" }),
    });

    // When
    await empty.useCase.execute({ campaignId: empty.campaignId });
    await finished.useCase.execute({ campaignId: finished.campaignId });

    // Then
    expect(empty.notifier.batches).toEqual([]);
    expect((await empty.stored()).status).toBe("COMPLETED");
    expect(finished.notifier.batches).toEqual([]);
    expect((await finished.stored()).status).toBe("FAILED");
  });
});

describe("FanOutBroadcastCampaignUseCase — 수신자 언어별 문구", () => {
  it("수신자 언어의 문구로 보내고 문구가 없는 언어는 기본 제목·본문으로 보낸다", async () => {
    // Given
    const campaign = createBroadcastCampaignFixture({
      localizedContent: { en: { title: "New feature", body: "Check it out." } },
    });
    const { useCase, campaignId, notifier } = setup({
      audience: ["user-en", "user-ja", "user-ko"],
      campaign,
      recipients: new StubBroadcastRecipientReader({
        "user-en": { locale: "en" },
        "user-ja": { locale: "ko" },
      }),
    });

    // When
    await useCase.execute({ campaignId });

    // Then
    expect(notifier.messages.map(({ userId, title, body }) => ({ userId, title, body }))).toEqual([
      { userId: "user-en", title: "New feature", body: "Check it out." },
      { userId: "user-ja", title: "새 기능 안내", body: "지금 확인해 보세요." },
      { userId: "user-ko", title: "새 기능 안내", body: "지금 확인해 보세요." },
    ]);
  });
});

describe("FanOutBroadcastCampaignUseCase — 수신자 현지 시각 발송", () => {
  // 기준 시각(2026-11-03 10:00Z)은 서울 19:00, LA 02:00
  const localTimeCampaign = () =>
    createBroadcastCampaignFixture({
      delivery: { mode: "RECIPIENT_LOCAL_TIME", localTime: "10:00", date: "2026-11-04" },
    });

  it("알림을 바로 만들지 않고 시간대별 발송 시각으로 묶어 작업을 한 번에 등록한다", async () => {
    // Given
    const { useCase, campaignId, notifier, jobEnqueuer, stored } = setup({
      audience: ["user-la", "user-seoul-1", "user-seoul-2"],
      campaign: localTimeCampaign(),
      recipients: new StubBroadcastRecipientReader({
        "user-la": { timeZone: "America/Los_Angeles" },
      }),
    });

    // When
    await useCase.execute({ campaignId });

    // Then - 서울 11-04 10:00 = 01:00Z, LA 11-04 10:00 PST = 18:00Z
    expect(notifier.batches).toEqual([]);
    expect(
      jobEnqueuer.deliveries.map(({ startAfter, userIds: groupUserIds }) => ({
        startAfter: startAfter.toString(),
        userIds: groupUserIds,
      })),
    ).toEqual([
      { startAfter: "2026-11-04T01:00:00Z", userIds: ["user-seoul-1", "user-seoul-2"] },
      { startAfter: "2026-11-04T18:00:00Z", userIds: ["user-la"] },
    ]);
    expect(jobEnqueuer.deliveryCalls).toBe(1);
    expect((await stored()).toPrimitives()).toMatchObject({
      status: "COMPLETED",
      processedCount: 3,
      queuedCount: 3,
    });
  });

  it("그 날짜·시각이 수신자에게 이미 지났으면 다음 날로 등록한다", async () => {
    // Given - 서울은 지금 11-03 19:00이라 11-03 10:00은 지났다
    const { useCase, campaignId, jobEnqueuer } = setup({
      audience: ["user-seoul"],
      campaign: createBroadcastCampaignFixture({
        delivery: { mode: "RECIPIENT_LOCAL_TIME", localTime: "10:00", date: "2026-11-03" },
      }),
    });

    // When
    await useCase.execute({ campaignId });

    // Then
    expect(jobEnqueuer.deliveries.map(({ startAfter }) => startAfter.toString())).toEqual([
      "2026-11-04T01:00:00Z",
    ]);
  });
});
