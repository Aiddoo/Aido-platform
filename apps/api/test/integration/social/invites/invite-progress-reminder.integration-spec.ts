import { eq } from "drizzle-orm";

import { InviteConfigPort } from "#api/modules/social/invites/application/ports/invite-config.port";
import { InviteRedemptionRepositoryPort } from "#api/modules/social/invites/application/ports/invite-redemption.repository.port";
import { GetMyInviteUseCase } from "#api/modules/social/invites/application/use-cases/get-my-invite.use-case";
import { RecordInviteeActivityUseCase } from "#api/modules/social/invites/application/use-cases/record-invitee-activity.use-case";
import { RedeemInviteUseCase } from "#api/modules/social/invites/application/use-cases/redeem-invite.use-case";
import { SendInviteQualifyReminderUseCase } from "#api/modules/social/invites/application/use-cases/send-invite-qualify-reminder.use-case";
import { qualifyReminderExpiresBefore } from "#api/modules/social/invites/domain/invite-qualify-reminder.domain-service";
import { inviteActiveDay, inviteRedemption, user } from "#api/platform/database/schema/index";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { createEntityId } from "#api/shared/domain/model/entity-id";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { UserFixture } from "#test/fixtures/index";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../../../e2e/helpers/e2e-app-factory.js";

// 2028-02-28 12:00 KST 수락 → 2028-03-13 12:00 KST 마감
const JOINED_AT = new Date("2028-02-28T03:00:00.000Z");
// 마감 1일 18시간 전, 18:00 KST
const REMINDER_AT = new Date("2028-03-11T09:00:00.000Z");
const REMINDER_INSTANT = instantFromDate(REMINDER_AT);

describe("초대 첫날·사용 시작 알림의 중복 방지 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let redeemInvite: RedeemInviteUseCase;
  let getMyInvite: GetMyInviteUseCase;
  let recordActivity: RecordInviteeActivityUseCase;
  let sendReminder: SendInviteQualifyReminderUseCase;
  let repository: InviteRedemptionRepositoryPort;
  let unitOfWork: UnitOfWorkPort;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 10 }) });
    client = await database.start();
    context = await createE2eApp({
      testDatabase: database,
      customizeBuilder: (builder) =>
        builder.overrideProvider(InviteConfigPort).useValue({ isEnabled: true }),
    });
    redeemInvite = context.module.get(RedeemInviteUseCase);
    getMyInvite = context.module.get(GetMyInviteUseCase);
    recordActivity = context.module.get(RecordInviteeActivityUseCase);
    sendReminder = context.module.get(SendInviteQualifyReminderUseCase);
    repository = context.module.get(InviteRedemptionRepositoryPort);
    unitOfWork = context.module.get(UnitOfWorkPort);
  });

  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(JOINED_AT);
  });

  afterEach(() => vi.useRealTimers());

  afterAll(async () => {
    if (context) {
      await destroyE2eApp(context);
    } else {
      await database?.stop();
    }
  });

  async function createUser(userTag: string): Promise<string> {
    const id = createEntityId();
    await client.insert(user).values(
      UserFixture.create({
        id,
        userTag,
        email: `${userTag.toLowerCase()}@example.test`,
        createdAt: instantFromDate(JOINED_AT),
      }),
    );
    return id;
  }

  async function redeemed(inviterTag: string, inviteeTag: string) {
    const inviterId = await createUser(inviterTag);
    const inviteeId = await createUser(inviteeTag);
    const { code } = await getMyInvite.execute({ inviterId });
    const result = await redeemInvite.execute({
      inviteeId,
      code,
      installationId: inviteeTag,
      timezone: "Asia/Seoul",
    });
    if (result.outcome !== "REDEEMED") {
      throw new Error("새 사용자 수락이 필요합니다");
    }
    return { inviterId, inviteeId, redemptionId: result.redemptionId };
  }

  async function noticesOf(type: "INVITE_PROGRESS" | "INVITE_QUALIFY_REMINDER") {
    return client.query.notification.findMany({
      columns: { userId: true },
      where: { type },
    });
  }

  it("첫날 할 일 완료가 동시에 두 번 와도 초대한 사람에게 첫날 알림은 한 번만 남는다", async () => {
    // Given
    const { inviterId, inviteeId } = await redeemed("PRGINVTR", "PRGINVTE");

    // When
    await Promise.all([
      recordActivity.execute({ inviteeId, occurredAt: instantFromDate(JOINED_AT) }),
      recordActivity.execute({
        inviteeId,
        occurredAt: Temporal.Instant.from("2028-02-28T04:00:00.000Z"),
      }),
    ]);
    await recordActivity.execute({
      inviteeId,
      occurredAt: Temporal.Instant.from("2028-02-28T05:00:00.000Z"),
    });

    // Then
    expect(await noticesOf("INVITE_PROGRESS")).toEqual([{ userId: inviterId }]);
  });

  it("배포 전에 이미 첫날이 있던 수락은 둘째 날에도 첫날 알림을 보내지 않는다", async () => {
    // Given
    const { inviteeId, redemptionId } = await redeemed("OLDINVTR", "OLDINVTE");
    await client
      .insert(inviteActiveDay)
      .values({ redemptionId, localDate: Temporal.PlainDate.from("2028-02-28") });

    // When
    await recordActivity.execute({
      inviteeId,
      occurredAt: Temporal.Instant.from("2028-02-29T03:00:00.000Z"),
    });

    // Then
    expect(await noticesOf("INVITE_PROGRESS")).toEqual([]);
  });

  it("마감이 다가온 하루 남은 수락만 후보로 읽고 알림은 작업이 다시 돌아도 한 번만 남긴다", async () => {
    // Given
    const due = await redeemed("DUEINVTR", "DUEINVTE");
    const notStarted = await redeemed("NEWINVTR", "NEWINVTE");
    const ineligible = await redeemed("INEINVTR", "INEINVTE");
    for (const { inviteeId } of [due, ineligible]) {
      await recordActivity.execute({ inviteeId, occurredAt: instantFromDate(JOINED_AT) });
    }
    await client
      .update(inviteRedemption)
      .set({ inviterRewardEligible: false })
      .where(eq(inviteRedemption.id, ineligible.redemptionId));
    vi.setSystemTime(REMINDER_AT);

    // When
    const candidates = await repository.listQualifyReminderCandidates({
      now: REMINDER_INSTANT,
      expiresBefore: qualifyReminderExpiresBefore(REMINDER_INSTANT),
      after: null,
      limit: 10,
    });
    const results = await Promise.all([
      sendReminder.execute({ redemptionId: due.redemptionId, now: REMINDER_INSTANT }),
      sendReminder.execute({ redemptionId: due.redemptionId, now: REMINDER_INSTANT }),
    ]);
    const rerun = await sendReminder.execute({
      redemptionId: due.redemptionId,
      now: REMINDER_INSTANT,
    });

    // Then
    expect(
      candidates.map(({ redemptionId, activeDayCount }) => ({ redemptionId, activeDayCount })),
    ).toEqual(
      expect.arrayContaining([
        { redemptionId: due.redemptionId, activeDayCount: 1 },
        { redemptionId: notStarted.redemptionId, activeDayCount: 0 },
      ]),
    );
    expect(candidates).toHaveLength(2);
    expect(results.map((result) => result.status).sort()).toEqual(["sent", "skipped"]);
    expect(rerun).toEqual({ status: "skipped", reason: "not-due" });
    expect(await noticesOf("INVITE_QUALIFY_REMINDER")).toEqual([{ userId: due.inviteeId }]);
    const stored = await client.query.inviteRedemption.findFirst({
      columns: { qualifyReminderSentAt: true },
      where: { id: due.redemptionId },
    });
    expect(stored?.qualifyReminderSentAt).toEqual(REMINDER_INSTANT);
    const nextRun = await unitOfWork.run(() =>
      repository.listQualifyReminderCandidates({
        now: REMINDER_INSTANT,
        expiresBefore: qualifyReminderExpiresBefore(REMINDER_INSTANT),
        after: null,
        limit: 10,
      }),
    );
    expect(nextRun.map((candidate) => candidate.redemptionId)).toEqual([notStarted.redemptionId]);
  });
});
