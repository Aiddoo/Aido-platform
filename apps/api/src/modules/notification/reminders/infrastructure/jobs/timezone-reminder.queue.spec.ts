import {
  TimezoneReminderJobName,
  TimezoneReminderRuntimeJobSchema,
} from "./timezone-reminder.queue.js";

describe("TimezoneReminderRuntimeJobSchema", () => {
  it("리마인더 잡의 이름과 payload 상관관계를 검증한다", () => {
    // When
    const reminderHourChanged = TimezoneReminderRuntimeJobSchema.safeParse({
      name: TimezoneReminderJobName.REMINDER_HOUR_CHANGED,
      data: { userId: "user-1", timezone: "Asia/Seoul" },
    });
    const invalidSocialDigest = TimezoneReminderRuntimeJobSchema.safeParse({
      name: TimezoneReminderJobName.SOCIAL_DIGEST,
      data: { recipientUserIds: ["user-1"] },
    });

    // Then
    expect(reminderHourChanged.success).toBe(true);
    expect(invalidSocialDigest.success).toBe(false);
  });
});
