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

  it.each([
    // 2028-03-12 서머타임 시작(PST→PDT): 08:00 PDT = 15:00Z
    { at: "2028-03-12T14:59:59.999Z", quiet: true },
    { at: "2028-03-12T15:00:00.000Z", quiet: false },
    // 전날은 PST라 08:00 = 16:00Z
    { at: "2028-03-11T15:59:59.999Z", quiet: true },
    { at: "2028-03-11T16:00:00.000Z", quiet: false },
    // 2028-11-05 서머타임 종료(PDT→PST): 08:00 PST = 16:00Z, 21:00 PST = 다음 날 05:00Z
    { at: "2028-11-05T15:59:59.999Z", quiet: true },
    { at: "2028-11-05T16:00:00.000Z", quiet: false },
    { at: "2028-11-06T04:59:59.999Z", quiet: false },
    { at: "2028-11-06T05:00:00.000Z", quiet: true },
  ])("로스앤젤레스 서머타임 전환일 $at의 야간 여부는 $quiet다", async ({ at, quiet }) => {
    // Given
    const reader = createReader({ losAngeles: "America/Los_Angeles" });

    // When
    const result = await reader.findUsersInQuietHours(["losAngeles"], new Date(at));

    // Then
    expect(result.has("losAngeles")).toBe(quiet);
  });
});
