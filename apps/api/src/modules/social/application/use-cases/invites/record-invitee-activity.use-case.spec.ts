import { mock } from "vitest-mock-extended";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { createUnitOfWorkMock } from "#test/mocks/ports/unit-of-work.mock";

import {
  InviteRedemption,
  type InviteRedemptionProps,
} from "../../../domain/aggregates/invites/invite-redemption.aggregate.js";
import type { UserBlockRelation } from "../../ports/blocks/user-block-reader.port.js";
import type { InviteProgressNotification } from "../../ports/invites/invite-notifier.port.js";
import { RecordInviteeActivity } from "./record-invitee-activity.use-case.js";

type RecordInviteeActivityDependencies = ConstructorParameters<typeof RecordInviteeActivity>[0];

// 2028-03-02 12:00 KST
const FIRST_DAY = new Date("2028-03-02T03:00:00.000Z");
const SECOND_DAY = new Date("2028-03-03T03:00:00.000Z");
const NO_BLOCK: UserBlockRelation = { isBlocking: false, isBlockedBy: false };

function redemptionProps(overrides: Partial<InviteRedemptionProps> = {}): InviteRedemptionProps {
  return {
    id: "redemption-1",
    inviteId: "invite-1",
    inviterId: "inviter-1",
    inviteeId: "invitee-1",
    status: "JOINED",
    rejectionReason: null,
    timezone: "Asia/Seoul",
    inviterRewardEligible: true,
    activeDays: [],
    joinedAt: new Date("2028-03-01T03:00:00.000Z"),
    qualifiedAt: null,
    rewardedAt: null,
    rejectedAt: null,
    expiresAt: new Date("2028-03-15T03:00:00.000Z"),
    qualifyReminderSentAt: null,
    ...overrides,
  };
}

/** 저장한 활동일을 다음 실행이 다시 읽도록 행 하나를 들고 있는 저장소 */
class StubRedemptionRepository implements Pick<
  RecordInviteeActivityDependencies["inviteRedemptionRepository"],
  "hasJoinedByInviteeId" | "findByInviteeIdForUpdate" | "save" | "findDisplayName"
> {
  #props: InviteRedemptionProps;

  constructor(props: InviteRedemptionProps) {
    this.#props = props;
  }

  async hasJoinedByInviteeId(): Promise<boolean> {
    return this.#props.status === "JOINED";
  }

  async findByInviteeIdForUpdate(): Promise<InviteRedemption> {
    return InviteRedemption.reconstitute(this.#props);
  }

  async save(redemption: InviteRedemption): Promise<void> {
    this.#props = { ...this.#props, activeDays: redemption.activeDays, status: redemption.status };
  }

  async findDisplayName(): Promise<string> {
    return "매튜";
  }
}

function createRecorder({
  props = redemptionProps(),
  isEnabled = true,
  areFriends = true,
  blockRelation = NO_BLOCK,
  isNotifierDown = false,
}: {
  props?: InviteRedemptionProps;
  isEnabled?: boolean;
  areFriends?: boolean;
  blockRelation?: UserBlockRelation;
  isNotifierDown?: boolean;
} = {}) {
  const notified: InviteProgressNotification[] = [];
  const repository = new StubRedemptionRepository(props);
  const recorder = new RecordInviteeActivity({
    inviteRedemptionRepository: {
      hasJoinedByInviteeId: () => repository.hasJoinedByInviteeId(),
      findByInviteeIdForUpdate: () => repository.findByInviteeIdForUpdate(),
      save: (redemption) => repository.save(redemption),
      findDisplayName: () => repository.findDisplayName(),
      summarizeByInviterId: async () => ({
        joinedCount: 1,
        qualifiedCount: 0,
        rewardedCount: 0,
        rejectedCount: 0,
      }),
    },
    rewardGrantRepository: {
      summarizeInviterRewards: async () => [],
      createPending: async (plans) => plans.length,
    },
    rewardScheduler: { schedule: async () => {}, scheduleMany: async () => {} },
    notifier: {
      notifyInviteProgress: async (notification) => {
        if (isNotifierDown) throw new Error("push outage");
        notified.push(notification);
      },
    },
    followReader: { isCurrentMutualFriend: async () => areFriends },
    blockReader: { findRelation: async () => blockRelation },
    inviteConfig: { isEnabled },
    mutationLock: { acquire: async () => {} },
    unitOfWork: createUnitOfWorkMock(),
    logger: mock<ApplicationLogger>(),
  });
  return { recorder, notified };
}

describe("RecordInviteeActivity — 첫날 알림", () => {
  it("초대받은 사람이 처음 할 일을 끝내면 초대한 사람에게 이름과 함께 한 번 알린다", async () => {
    // Given
    const { recorder, notified } = createRecorder();

    // When
    const result = await recorder.execute({ inviteeId: "invitee-1", occurredAt: FIRST_DAY });

    // Then
    expect(result).toEqual({ status: "recorded" });
    expect(notified).toEqual([
      { inviterId: "inviter-1", inviteeName: "매튜", redemptionId: "redemption-1" },
    ]);
  });

  it("같은 날 할 일을 또 끝내면 다시 알리지 않는다", async () => {
    // Given
    const { recorder, notified } = createRecorder();
    await recorder.execute({ inviteeId: "invitee-1", occurredAt: FIRST_DAY });

    // When
    const result = await recorder.execute({
      inviteeId: "invitee-1",
      occurredAt: new Date("2028-03-02T10:00:00.000Z"),
    });

    // Then
    expect(result).toEqual({ status: "skipped" });
    expect(notified).toHaveLength(1);
  });

  it("둘째 날은 사용 시작(보상 알림)으로 넘어가고 첫날 알림을 다시 보내지 않는다", async () => {
    // Given
    const { recorder, notified } = createRecorder({
      props: redemptionProps({ activeDays: ["2028-03-02"] }),
    });

    // When
    const result = await recorder.execute({ inviteeId: "invitee-1", occurredAt: SECOND_DAY });

    // Then
    expect(result).toMatchObject({ status: "qualified" });
    expect(notified).toEqual([]);
  });

  it.each([
    { label: "친구를 끊음", options: { areFriends: false } },
    {
      label: "초대한 사람을 차단함",
      options: { blockRelation: { ...NO_BLOCK, isBlocking: true } },
    },
    {
      label: "초대한 사람이 차단함",
      options: { blockRelation: { ...NO_BLOCK, isBlockedBy: true } },
    },
    { label: "초대 기능이 꺼짐", options: { isEnabled: false } },
    { label: "초대한 사람이 탈퇴함", options: { props: redemptionProps({ inviterId: null }) } },
  ])("$label이면 첫날을 기록하되 알리지 않는다", async ({ options }) => {
    // Given
    const { recorder, notified } = createRecorder(options);

    // When
    const result = await recorder.execute({ inviteeId: "invitee-1", occurredAt: FIRST_DAY });

    // Then
    expect(result).toEqual({ status: "recorded" });
    expect(notified).toEqual([]);
  });

  it("알림이 실패해도 활동일 기록은 성공으로 끝난다", async () => {
    // Given
    const { recorder } = createRecorder({ isNotifierDown: true });

    // When
    const result = await recorder.execute({ inviteeId: "invitee-1", occurredAt: FIRST_DAY });

    // Then
    expect(result).toEqual({ status: "recorded" });
  });
});
