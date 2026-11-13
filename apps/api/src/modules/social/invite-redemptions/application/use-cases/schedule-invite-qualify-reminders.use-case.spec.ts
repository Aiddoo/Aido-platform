import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { InMemoryInviteRedemptionReader } from "#test/doubles/social/in-memory-invite-redemption.reader";
import { InMemoryInviteRedemptionRepository } from "#test/doubles/social/in-memory-invite-redemption.repository";
import { InMemoryRewardGrantRepository } from "#test/doubles/social/in-memory-reward-grant.repository";
import { RecordingInviteQualifyReminderScheduler } from "#test/doubles/social/recording-invite-qualify-reminder-scheduler";
import {
  activeDaysOf,
  createInviteRedemptionFixture,
} from "#test/fixtures/social/invite-redemption.fixture";
import { inviteFixtureInviteeId } from "#test/fixtures/social/invite.fixture";

import { ScheduleInviteQualifyRemindersUseCase } from "./schedule-invite-qualify-reminders.use-case.js";

// 정비 작업 실행 시각: 2028-03-02 03:30 KST
const NOW = Temporal.Instant.from("2028-03-01T18:30:00Z");
// 그날 18:00 KST
const TODAY_EVENING = Temporal.Instant.from("2028-03-02T09:00:00Z");

function candidateOf(
  index: number,
  overrides: Parameters<typeof createInviteRedemptionFixture>[0] = {},
) {
  return createInviteRedemptionFixture({
    id: `c0000000000000000000rdm0${index}`,
    inviteeId: inviteFixtureInviteeId(index),
    activeDays: activeDaysOf("2028-02-28"),
    expiresAt: Temporal.Instant.from("2028-03-04T03:00:00Z"),
    ...overrides,
  });
}

function createScheduler(
  redemptions: Parameters<typeof createInviteRedemptionFixture>[0][],
  isEnabled = true,
) {
  const reminderScheduler = new RecordingInviteQualifyReminderScheduler();
  const useCase = new ScheduleInviteQualifyRemindersUseCase({
    inviteRedemptionReader: new InMemoryInviteRedemptionReader(
      new InMemoryInviteRedemptionRepository(
        redemptions.map((overrides, index) => candidateOf(index, overrides)),
      ),
      new InMemoryRewardGrantRepository(),
    ),
    reminderScheduler,
    inviteConfig: { isEnabled },
    logger: new SilentLogger(),
  });
  return { useCase, reminderScheduler };
}

describe("ScheduleInviteQualifyRemindersUseCase — 사용 시작 알림 예약", () => {
  it("하루만 더 남은 수락만 초대받은 사람 시간대 저녁으로 예약한다", async () => {
    // Given
    const { useCase, reminderScheduler } = createScheduler([
      { activeDays: [] },
      { activeDays: activeDaysOf("2028-02-28") },
      { activeDays: activeDaysOf("2028-02-28", "2028-02-29") },
    ]);

    // When
    const result = await useCase.execute({ now: NOW });

    // Then
    expect(result).toEqual({ scheduledCount: 1 });
    expect(reminderScheduler.scheduled).toEqual([
      { redemptionId: "c0000000000000000000rdm01", sendAt: TODAY_EVENING },
    ]);
  });

  it("보낼 시각에 이미 마감되는 수락은 예약하지 않는다", async () => {
    // Given
    const { useCase, reminderScheduler } = createScheduler([
      { expiresAt: Temporal.Instant.from("2028-03-02T08:59:00Z") },
    ]);

    // When
    await useCase.execute({ now: NOW });

    // Then
    expect(reminderScheduler.scheduled).toEqual([]);
  });

  it("초대 기능이 꺼져 있으면 후보를 읽지 않는다", async () => {
    // Given
    const { useCase, reminderScheduler } = createScheduler([{}], false);

    // When
    const result = await useCase.execute({ now: NOW });

    // Then
    expect(result).toEqual({ scheduledCount: 0 });
    expect(reminderScheduler.scheduled).toEqual([]);
  });
});
