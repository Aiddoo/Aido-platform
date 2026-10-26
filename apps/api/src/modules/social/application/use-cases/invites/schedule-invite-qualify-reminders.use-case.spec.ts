import { mock } from "vitest-mock-extended";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import type { ScheduledQualifyReminder } from "../../ports/invites/invite-qualify-reminder.scheduler.port.js";
import type { QualifyReminderCandidate } from "../../ports/invites/invite-redemption.repository.port.js";
import { ScheduleInviteQualifyReminders } from "./schedule-invite-qualify-reminders.use-case.js";

// 정비 작업 실행 시각: 2028-03-02 03:30 KST
const NOW = new Date("2028-03-01T18:30:00.000Z");
// 그날 18:00 KST
const TODAY_EVENING = new Date("2028-03-02T09:00:00.000Z");

function candidate(overrides: Partial<QualifyReminderCandidate>): QualifyReminderCandidate {
  return {
    redemptionId: "redemption-1",
    timezone: "Asia/Seoul",
    expiresAt: new Date("2028-03-04T03:00:00.000Z"),
    activeDayCount: 1,
    ...overrides,
  };
}

function createScheduler(candidates: readonly QualifyReminderCandidate[], isEnabled = true) {
  const scheduled: ScheduledQualifyReminder[] = [];
  const scheduler = new ScheduleInviteQualifyReminders({
    inviteRedemptionRepository: { findQualifyReminderCandidates: async () => [...candidates] },
    reminderScheduler: {
      scheduleMany: async (reminders) => {
        scheduled.push(...reminders);
      },
    },
    inviteConfig: { isEnabled },
    logger: mock<ApplicationLogger>(),
  });
  return { scheduler, scheduled };
}

describe("ScheduleInviteQualifyReminders", () => {
  it("하루만 더 남은 수락만 초대받은 사람 시간대 저녁으로 예약한다", async () => {
    // Given
    const { scheduler, scheduled } = createScheduler([
      candidate({ redemptionId: "no-day", activeDayCount: 0 }),
      candidate({ redemptionId: "one-day", activeDayCount: 1 }),
      candidate({ redemptionId: "two-days", activeDayCount: 2 }),
    ]);

    // When
    const result = await scheduler.execute({ now: NOW });

    // Then
    expect(result).toEqual({ scheduledCount: 1 });
    expect(scheduled).toEqual([{ redemptionId: "one-day", sendAt: TODAY_EVENING }]);
  });

  it("보낼 시각에 이미 마감되는 수락은 예약하지 않는다", async () => {
    // Given
    const { scheduler, scheduled } = createScheduler([
      candidate({ expiresAt: new Date("2028-03-02T08:59:00.000Z") }),
    ]);

    // When
    await scheduler.execute({ now: NOW });

    // Then
    expect(scheduled).toEqual([]);
  });

  it("초대 기능이 꺼져 있으면 후보를 읽지 않는다", async () => {
    // Given
    const { scheduler, scheduled } = createScheduler([candidate({})], false);

    // When
    const result = await scheduler.execute({ now: NOW });

    // Then
    expect(result).toEqual({ scheduledCount: 0 });
    expect(scheduled).toEqual([]);
  });
});
