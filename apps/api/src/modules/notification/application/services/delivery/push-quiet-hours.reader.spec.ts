import { PushQuietHoursReader } from "./push-quiet-hours.reader.js";

function createReader(timezones: Readonly<Record<string, string>>) {
  return new PushQuietHoursReader({
    userSettings: {
      getPreferenceRecordsByUserIds: async (userIds) =>
        userIds.flatMap((userId) => {
          const timezone = timezones[userId];
          if (timezone == null) return [];
          return [
            {
              userId,
              timezone,
              pushEnabled: true,
              nightPushEnabled: false,
              locale: "ko",
              morningReminderHour: 8,
              morningReminderMinute: 0,
              eveningReminderHour: 19,
              eveningReminderMinute: 0,
              timeFormat: "TWELVE_HOUR" as const,
              weatherMorningEnabled: true,
              weatherMorningHour: 7,
              weatherMorningMinute: 0,
              weatherEveningEnabled: true,
              weatherEveningHour: 17,
              weatherEveningMinute: 30,
            },
          ];
        }),
    },
  });
}

describe("PushQuietHoursReader", () => {
  it("배송 시간대 기준 21시부터 8시 전까지를 야간으로 보고 설정이 없거나 UTC면 서울 시간으로 판단한다", async () => {
    // Given
    const reader = createReader({
      seoul: "Asia/Seoul",
      losAngeles: "America/Los_Angeles",
      legacyUtc: "UTC",
    });
    const at = new Date("2028-02-26T17:00:00.000Z");

    // When
    const quiet = await reader.findUsersInQuietHours(
      ["seoul", "losAngeles", "legacyUtc", "missing"],
      at,
    );

    // Then
    expect([...quiet].sort()).toEqual(["legacyUtc", "missing", "seoul"]);
  });
});
