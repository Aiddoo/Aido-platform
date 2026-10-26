import {
  INVITE_REDEMPTION_REPOSITORY,
  type InviteRedemptionRepositoryPort,
} from "#api/modules/social/application/ports/invites/invite-redemption.repository.port";
import { INVITE_CONFIG } from "#api/modules/social/application/ports/invites/invite.config.port";
import { GetMyInvite } from "#api/modules/social/application/use-cases/invites/get-my-invite.use-case";
import { RecordInviteeActivity } from "#api/modules/social/application/use-cases/invites/record-invitee-activity.use-case";
import { RedeemInvite } from "#api/modules/social/application/use-cases/invites/redeem-invite.use-case";
import { SendInviteQualifyReminder } from "#api/modules/social/application/use-cases/invites/send-invite-qualify-reminder.use-case";
import { qualifyReminderExpiresBefore } from "#api/modules/social/domain/policies/invites/invite-qualify-reminder.policy";
import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { applicationDate, createEntityId } from "#api/platform/database/database-values";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { UserFixture } from "#test/fixtures/index";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../e2e/helpers/e2e-app-factory.js";

// 2028-02-28 12:00 KST 수락 → 2028-03-13 12:00 KST 마감
const JOINED_AT = new Date("2028-02-28T03:00:00.000Z");
// 마감 1일 18시간 전, 18:00 KST
const REMINDER_AT = new Date("2028-03-11T09:00:00.000Z");

describe("초대 첫날·사용 시작 알림의 중복 방지 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let redeemInvite: RedeemInvite;
  let getMyInvite: GetMyInvite;
  let recordActivity: RecordInviteeActivity;
  let sendReminder: SendInviteQualifyReminder;
  let repository: InviteRedemptionRepositoryPort;
  let unitOfWork: UnitOfWorkPort;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 10 }) });
    client = await database.start();
    context = await createE2eApp({
      testDatabase: database,
      customizeBuilder: (builder) =>
        builder.overrideProvider(INVITE_CONFIG).useValue({ isEnabled: true }),
    });
    redeemInvite = context.module.get(RedeemInvite);
    getMyInvite = context.module.get(GetMyInvite);
    recordActivity = context.module.get(RecordInviteeActivity);
    sendReminder = context.module.get(SendInviteQualifyReminder);
    repository = context.module.get<InviteRedemptionRepositoryPort>(INVITE_REDEMPTION_REPOSITORY);
    unitOfWork = context.module.get<UnitOfWorkPort>(UNIT_OF_WORK);
  });

  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(JOINED_AT);
  });

  afterEach(() => vi.useRealTimers());

  afterAll(async () => {
    if (context) await destroyE2eApp(context);
    else await database?.stop();
  });

  async function createUser(userTag: string): Promise<string> {
    const id = createEntityId();
    await client.orm.public.User.create(
      encodeCreate(
        "User",
        UserFixture.create({
          id,
          userTag,
          email: `${userTag.toLowerCase()}@example.test`,
          createdAt: JOINED_AT,
        }),
      ),
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
    if (result.outcome !== "REDEEMED") throw new Error("새 사용자 수락이 필요합니다");
    return { inviterId, inviteeId, redemptionId: result.redemptionId };
  }

  async function noticesOf(type: "INVITE_PROGRESS" | "INVITE_QUALIFY_REMINDER") {
    return client.orm.public.Notification.where((row) => row._type.eq(type))
      .select("userId")
      .all();
  }

  it("첫날 할 일 완료가 동시에 두 번 와도 초대한 사람에게 첫날 알림은 한 번만 남는다", async () => {
    // Given
    const { inviterId, inviteeId } = await redeemed("PRGINVTR", "PRGINVTE");

    // When
    await Promise.all([
      recordActivity.execute({ inviteeId, occurredAt: JOINED_AT }),
      recordActivity.execute({ inviteeId, occurredAt: new Date("2028-02-28T04:00:00.000Z") }),
    ]);
    await recordActivity.execute({ inviteeId, occurredAt: new Date("2028-02-28T05:00:00.000Z") });

    // Then
    expect(await noticesOf("INVITE_PROGRESS")).toEqual([{ userId: inviterId }]);
  });

  it("배포 전에 이미 첫날이 있던 수락은 둘째 날에도 첫날 알림을 보내지 않는다", async () => {
    // Given
    const { inviteeId, redemptionId } = await redeemed("OLDINVTR", "OLDINVTE");
    await client.orm.public.InviteActiveDay.create(
      encodeCreate("InviteActiveDay", { redemptionId, localDate: applicationDate("2028-02-28") }),
    );

    // When
    await recordActivity.execute({ inviteeId, occurredAt: new Date("2028-02-29T03:00:00.000Z") });

    // Then
    expect(await noticesOf("INVITE_PROGRESS")).toEqual([]);
  });

  it("마감이 다가온 하루 남은 수락만 후보로 읽고 알림은 작업이 다시 돌아도 한 번만 남긴다", async () => {
    // Given
    const due = await redeemed("DUEINVTR", "DUEINVTE");
    const notStarted = await redeemed("NEWINVTR", "NEWINVTE");
    const ineligible = await redeemed("INEINVTR", "INEINVTE");
    for (const { inviteeId } of [due, ineligible]) {
      await recordActivity.execute({ inviteeId, occurredAt: JOINED_AT });
    }
    await client.orm.public.InviteRedemption.where({ id: ineligible.redemptionId }).updateAndCount(
      encodePatch("InviteRedemption", { inviterRewardEligible: false }),
    );
    vi.setSystemTime(REMINDER_AT);

    // When
    const candidates = await repository.findQualifyReminderCandidates({
      now: REMINDER_AT,
      expiresBefore: qualifyReminderExpiresBefore(REMINDER_AT),
      limit: 10,
    });
    const results = await Promise.all([
      sendReminder.execute({ redemptionId: due.redemptionId, now: REMINDER_AT }),
      sendReminder.execute({ redemptionId: due.redemptionId, now: REMINDER_AT }),
    ]);
    const rerun = await sendReminder.execute({ redemptionId: due.redemptionId, now: REMINDER_AT });

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
    const [stored] = decodeRecord(
      "InviteRedemption",
      await client.orm.public.InviteRedemption.where({ id: due.redemptionId })
        .select("qualifyReminderSentAt")
        .all(),
    );
    expect(stored?.qualifyReminderSentAt).toEqual(REMINDER_AT);
    // 보낸 수락은 다음 정비 실행의 후보에서 빠진다
    const nextRun = await unitOfWork.run(() =>
      repository.findQualifyReminderCandidates({
        now: REMINDER_AT,
        expiresBefore: qualifyReminderExpiresBefore(REMINDER_AT),
        limit: 10,
      }),
    );
    expect(nextRun.map((candidate) => candidate.redemptionId)).toEqual([notStarted.redemptionId]);
  });
});
