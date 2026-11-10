import { ErrorCode } from "@aido/api/errors";

import { InMemoryAdminUserDirectoryReader } from "#test/doubles/operations/in-memory-admin-user-directory.reader";
import { InMemoryBroadcastCampaignRepository } from "#test/doubles/operations/in-memory-broadcast-campaign.repository";
import { RecordingBroadcastJobEnqueuer } from "#test/doubles/operations/recording-broadcast-job-enqueuer";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  BROADCAST_FIXTURE_NOW,
  BROADCAST_FIXTURE_REQUEST_ID,
  createBroadcastCampaignFixture,
} from "#test/fixtures/operations/broadcast-campaign.fixture";

import {
  type CreateBroadcastCampaignCommand,
  CreateBroadcastCampaignUseCase,
} from "./create-broadcast-campaign.use-case.js";

function setup(
  options: { existing?: ReturnType<typeof createBroadcastCampaignFixture>; targets?: number } = {},
) {
  const campaignRepository = new InMemoryBroadcastCampaignRepository(
    options.existing == null ? [] : [options.existing],
  );
  const jobEnqueuer = new RecordingBroadcastJobEnqueuer();
  const userIds = Array.from({ length: options.targets ?? 3 }, (_, index) => `user-${index}`);
  const useCase = new CreateBroadcastCampaignUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    campaignRepository,
    userDirectory: new InMemoryAdminUserDirectoryReader(userIds),
    jobEnqueuer,
    clock: new FixedClock(BROADCAST_FIXTURE_NOW),
    logger: new SilentLogger(),
  });
  return { useCase, campaignRepository, jobEnqueuer };
}

const command: CreateBroadcastCampaignCommand = {
  requestId: BROADCAST_FIXTURE_REQUEST_ID,
  title: "새 기능 안내",
  body: "지금 확인해 보세요.",
  targetFilter: "ALL",
  force: false,
};

describe("CreateBroadcastCampaignUseCase — 브로드캐스트 접수", () => {
  it("새 요청은 캠페인을 만들고 첫 분배 작업을 같은 transaction에 등록한다", async () => {
    // Given
    const { useCase, campaignRepository, jobEnqueuer } = setup({ targets: 1200 });

    // When
    const result = await useCase.execute(command);

    // Then
    expect(campaignRepository.size).toBe(1);
    expect(jobEnqueuer.fanOuts).toEqual([
      { campaignId: result.campaign.id.value, cursorUserId: null },
    ]);
    expect(result).toMatchObject({ targetCount: 1200, campaign: { status: "QUEUED" } });
    expect(result.campaign.toPrimitives()).toMatchObject({
      localizedContent: null,
      delivery: { mode: "NOW" },
    });
  });

  it("언어별 문구와 수신자 현지 시각 발송을 캠페인에 담는다", async () => {
    // Given
    const { useCase } = setup();

    // When
    const { campaign } = await useCase.execute({
      ...command,
      localizedContent: { en: { title: "New feature", body: " Check it out. " } },
      delivery: { mode: "RECIPIENT_LOCAL_TIME", localTime: "10:00", date: "2026-11-11" },
    });

    // Then
    expect(campaign.toPrimitives()).toMatchObject({
      localizedContent: { en: { title: "New feature", body: "Check it out." } },
      delivery: { mode: "RECIPIENT_LOCAL_TIME", localTime: "10:00", date: "2026-11-11" },
    });
  });

  it("같은 요청 ID의 같은 재요청은 새로 분배하지 않고 처음 캠페인을 돌려준다", async () => {
    // Given
    const existing = createBroadcastCampaignFixture({ status: "FANNING_OUT" });
    const { useCase, jobEnqueuer, campaignRepository } = setup({ existing });

    // When
    const result = await useCase.execute(command);

    // Then
    expect(jobEnqueuer.fanOuts).toEqual([]);
    expect(campaignRepository.size).toBe(1);
    expect(result.campaign.id.value).toBe(existing.id.value);
  });

  it("같은 요청 ID로 다른 내용을 보내면 409로 거절한다", async () => {
    // Given
    const { useCase, jobEnqueuer } = setup({ existing: createBroadcastCampaignFixture() });

    // When
    const result = useCase.execute({ ...command, body: "바뀐 본문" });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.ADMIN_1405 });
    expect(jobEnqueuer.fanOuts).toEqual([]);
  });

  it("같은 요청 ID로 언어별 문구나 발송 시점이 바뀌어도 409로 거절한다", async () => {
    // Given
    const { useCase } = setup({ existing: createBroadcastCampaignFixture() });

    // Then
    await expect(
      useCase.execute({ ...command, localizedContent: { en: { title: "t", body: "b" } } }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.ADMIN_1405 });
    await expect(
      useCase.execute({
        ...command,
        delivery: { mode: "RECIPIENT_LOCAL_TIME", localTime: "10:00", date: "2026-11-11" },
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.ADMIN_1405 });
  });

  it("대상이 없으면 캠페인을 남기지 않도록 404로 거절한다", async () => {
    // Given
    const { useCase, jobEnqueuer } = setup({ targets: 0 });

    // When
    const result = useCase.execute(command);

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.ADMIN_1402 });
    expect(jobEnqueuer.fanOuts).toEqual([]);
  });

  it("제목이나 본문이 비어 있으면 저장 전에 SYS_0002로 거절한다", async () => {
    // Given
    const { useCase, campaignRepository } = setup();

    // When
    const result = useCase.execute({ ...command, title: "   " });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
    expect(campaignRepository.size).toBe(0);
  });
});
