import { Timezone } from "#api/shared/domain/time/timezone.vo";

import type { NotificationType } from "../../shared/domain/notification-type.constants.js";
import { type PushExpiryInput, resolvePushExpiry } from "./push-delivery-options.domain-service.js";

const HOUR_SECONDS = 3600;
// 서울 10:00. 자정·야간이 멀어 종류 기본값만 보인다
const SEOUL_MORNING = Temporal.Instant.from("2026-11-18T01:00:00Z");

function expiryOf(overrides: Partial<PushExpiryInput> & Pick<PushExpiryInput, "type">) {
  return resolvePushExpiry({
    now: SEOUL_MORNING,
    timezone: Timezone.reconstitute("Asia/Seoul"),
    expiresBeforeQuietHours: false,
    reminderEndsAt: null,
    ...overrides,
  });
}

describe("resolvePushExpiry — 받는 사람 기준 푸시 보관 시간", () => {
  it.each<[NotificationType, number]>([
    ["TODO_REMINDER", 1],
    ["MORNING_REMINDER", 2],
    ["WEATHER_EVENING", 2],
    ["LUNCH_NUDGE", 3],
    ["DAILY_COMPLETE", 3],
    ["CHEER_RECEIVED", 12],
    ["TODO_SHARED", 12],
    ["WINBACK", 24],
    ["ADMIN_BROADCAST", 24],
    ["PREMIUM_TRIAL_ENDING", 24],
  ])("자정·야간이 멀면 %s는 종류 기본값 %i시간이다", (type, hours) => {
    // When
    const expiry = expiryOf({ type });

    // Then
    expect(expiry).toEqual({ status: "deliverable", ttlSeconds: hours * HOUR_SECONDS });
  });

  describe("할 일 리마인더는 할 일 시작까지만 보관한다", () => {
    const startsAt = Temporal.Instant.from("2026-11-18T02:00:00Z");

    it.each([
      { stage: "60분 전", minutesBefore: 60, ttlSeconds: 3600 },
      { stage: "10분 전", minutesBefore: 10, ttlSeconds: 600 },
      { stage: "시작 30초 전", minutesBefore: 0.5, ttlSeconds: 60 },
      { stage: "이미 시작", minutesBefore: -5, ttlSeconds: 60 },
    ])("$stage 발송은 $ttlSeconds초다(최소 60초, 최대 1시간)", ({ minutesBefore, ttlSeconds }) => {
      // Given
      const now = startsAt.subtract({ seconds: minutesBefore * 60 });

      // When
      const expiry = expiryOf({ type: "TODO_REMINDER", now, reminderEndsAt: startsAt });

      // Then
      expect(expiry).toEqual({ status: "deliverable", ttlSeconds });
    });

    it("90분 뒤 시작이어도 종류 상한 1시간을 넘지 않는다", () => {
      // When
      const expiry = expiryOf({
        type: "TODO_REMINDER",
        reminderEndsAt: SEOUL_MORNING.add({ minutes: 90 }),
      });

      // Then
      expect(expiry).toEqual({ status: "deliverable", ttlSeconds: HOUR_SECONDS });
    });
  });

  describe("그날만 뜻이 있는 알림은 받는 사람 자정까지만 보관한다", () => {
    it("서울 23:00 하루 완료는 3시간이 아니라 자정까지 1시간이다", () => {
      // When
      const expiry = expiryOf({
        type: "DAILY_COMPLETE",
        now: Temporal.Instant.from("2026-11-18T14:00:00Z"),
      });

      // Then
      expect(expiry).toEqual({ status: "deliverable", ttlSeconds: HOUR_SECONDS });
    });

    it("자정이 없는 서머타임 시작일(아바나 00:00→01:00)은 그날 첫 순간까지다", () => {
      // When
      const expiry = expiryOf({
        type: "FRIEND_COMPLETED",
        // 아바나 2026-03-07 23:00(-05:00). 다음 날은 01:00(-04:00)에 시작한다
        now: Temporal.Instant.from("2026-03-08T04:00:00Z"),
        timezone: Timezone.reconstitute("America/Havana"),
      });

      // Then
      expect(expiry).toEqual({ status: "deliverable", ttlSeconds: HOUR_SECONDS });
    });
  });

  describe("그날만 뜻이 있는 알림은 자정까지 1분 미만이면 보내지 않는다", () => {
    it("서울 23:59:59.5 하루 완료는 ttl 0 대신 야간 건너뜀이다", () => {
      // When
      const expiry = expiryOf({
        type: "DAILY_COMPLETE",
        now: Temporal.Instant.from("2026-11-18T14:59:59.5Z"),
      });

      // Then
      expect(expiry).toEqual({ status: "quiet-hours" });
    });

    it("서울 23:58:59 하루 완료는 자정까지 61초 보관한다", () => {
      // When
      const expiry = expiryOf({
        type: "DAILY_COMPLETE",
        now: Temporal.Instant.from("2026-11-18T14:58:59Z"),
      });

      // Then
      expect(expiry).toEqual({ status: "deliverable", ttlSeconds: 61 });
    });
  });

  describe("야간 전에 사라져야 하는 알림은 받는 사람 21:00까지만 보관한다", () => {
    it("서울 20:15 스트릭 위기(3시간)는 21:00까지 45분이다", () => {
      // When
      const expiry = expiryOf({
        type: "STREAK_AT_RISK",
        now: Temporal.Instant.from("2026-11-18T11:15:00Z"),
        expiresBeforeQuietHours: true,
      });

      // Then
      expect(expiry).toEqual({ status: "deliverable", ttlSeconds: 45 * 60 });
    });

    it("같은 순간 LA(03:15)는 야간이라 보내지 않는다", () => {
      // When
      const expiry = expiryOf({
        type: "STREAK_AT_RISK",
        now: Temporal.Instant.from("2026-11-18T11:15:00Z"),
        timezone: Timezone.reconstitute("America/Los_Angeles"),
        expiresBeforeQuietHours: true,
      });

      // Then
      expect(expiry).toEqual({ status: "quiet-hours" });
    });

    it("서머타임이 시작된 날(LA 3월 8일) 20:15도 바뀐 오프셋의 21:00까지 45분이다", () => {
      // When
      const expiry = expiryOf({
        type: "LUNCH_NUDGE",
        now: Temporal.Instant.from("2026-03-09T03:15:00Z"),
        timezone: Timezone.reconstitute("America/Los_Angeles"),
        expiresBeforeQuietHours: true,
      });

      // Then
      expect(expiry).toEqual({ status: "deliverable", ttlSeconds: 45 * 60 });
    });

    it.each([
      {
        local: "20:55",
        utc: "2026-11-18T11:55:00Z",
        expected: { status: "deliverable", ttlSeconds: 300 },
      },
      {
        local: "20:56",
        utc: "2026-11-18T11:56:00Z",
        expected: { status: "deliverable", ttlSeconds: 240 },
      },
      {
        local: "20:59",
        utc: "2026-11-18T11:59:00Z",
        expected: { status: "deliverable", ttlSeconds: 60 },
      },
      { local: "20:59:30", utc: "2026-11-18T11:59:30Z", expected: { status: "quiet-hours" } },
    ] as const)(
      "21:00까지 남은 만큼 보관하고 1분 미만이면 보내지 않는다(서울 $local)",
      ({ utc, expected }) => {
        // When
        const expiry = expiryOf({
          type: "WINBACK",
          now: Temporal.Instant.from(utc),
          expiresBeforeQuietHours: true,
        });

        // Then
        expect(expiry).toEqual(expected);
      },
    );

    it("야간 수신을 끈 사람의 친구 알림(12시간)은 서울 15:00에 21:00까지 6시간이다", () => {
      // When
      const expiry = expiryOf({
        type: "FOLLOW_NEW",
        now: Temporal.Instant.from("2026-11-18T06:00:00Z"),
        expiresBeforeQuietHours: true,
      });

      // Then
      expect(expiry).toEqual({ status: "deliverable", ttlSeconds: 6 * HOUR_SECONDS });
    });
  });
});
