import { TimeZone } from "#api/shared/domain/time/time-zone.vo";

import {
  isWithinQuietHours,
  PUSH_QUIET_HOURS_WINDOW,
} from "../../domain/quiet-hours.domain-service.js";
import { MARKETING_CONSENT_RECONFIRM_QUEUE } from "./marketing-consent-reconfirm.queue.js";

const TIMEZONES = [
  "Pacific/Honolulu",
  "America/Los_Angeles",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
  "Pacific/Kiritimati",
];

function isQuiet(instant: Temporal.Instant, timeZone: string): boolean {
  return isWithinQuietHours({
    instant,
    timeZone: TimeZone.reconstitute(timeZone),
    window: PUSH_QUIET_HOURS_WINDOW,
  });
}

describe("광고성 동의 재확인 큐 계약", () => {
  it("queue 이름과 예약 key를 유지하고 매시 정각에 예약한다", () => {
    // Given / When / Then: 예약 key가 같아야 배포 때 기존 예약을 덮어쓴다
    expect(MARKETING_CONSENT_RECONFIRM_QUEUE).toMatchObject({
      name: "notification.marketing-consent-reconfirm.v1",
      schedules: [
        {
          key: "hourly-marketing-consent-reconfirm-scheduler",
          cron: "0 * * * *",
          timezone: "Asia/Seoul",
          missed: "skip",
        },
      ],
    });
  });

  it("하루 한 번 10:00 KST에 돌면 현지 야간이라 영영 건너뛰는 시간대가 생겨 매시 실행을 둔다", () => {
    // Given: 10:00 KST = 01:00Z
    const tenAmKst = Temporal.Instant.from("2026-07-15T01:00:00Z");

    // When
    const quietAtTenKst = TIMEZONES.filter((timeZone) => isQuiet(tenAmKst, timeZone));
    const hourlyRuns = Array.from({ length: 24 }, (_, hour) => tenAmKst.add({ hours: hour }));
    const neverDaytime = TIMEZONES.filter((timeZone) =>
      hourlyRuns.every((run) => isQuiet(run, timeZone)),
    );

    // Then
    expect(quietAtTenKst).toEqual(
      expect.arrayContaining(["America/New_York", "Europe/London", "Asia/Kolkata"]),
    );
    expect(neverDaytime).toEqual([]);
  });
});
