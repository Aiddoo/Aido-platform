/**
 * TodoSchedule VO 단위 테스트
 *
 * GWT 패턴 — 날짜 불변식 검증
 */

import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

import { TodoSchedule } from "./todo-schedule.vo.js";

describe("TodoSchedule — 일정 값 객체", () => {
  const START = Temporal.PlainDate.from("2026-03-01");
  const LOCAL = "06:00";
  const TIME = Temporal.Instant.from("2026-03-01T06:00:00.000Z");
  const ZONE = "UTC";

  it.each([
    {
      name: "종일인데 시간이 있으면 시간 일정",
      isAllDay: true,
      scheduledLocalTime: LOCAL,
      instant: TIME,
      allDay: false,
    },
    {
      name: "시간 일정인데 시간이 없으면 종일",
      isAllDay: false,
      scheduledLocalTime: null,
      instant: null,
      allDay: true,
    },
  ])("$name으로 맞춘다", ({ isAllDay, scheduledLocalTime, instant, allDay }) => {
    // Given
    const props = { startDate: START, endDate: null, scheduledLocalTime, isAllDay, timezone: ZONE };
    // When
    const schedule = TodoSchedule.create(props);
    // Then
    expect(schedule.isAllDay).toBe(allDay);
    expect(schedule.scheduledTime).toEqual(instant);
    expect(schedule.scheduledLocalTime).toBe(scheduledLocalTime);
  });

  it.each([
    { name: "종일로 바꾸면 시간을 지운다", patch: { isAllDay: true }, time: null, allDay: true },
    {
      name: "시간을 지우면 종일이 된다",
      patch: { scheduledLocalTime: null },
      time: null,
      allDay: true,
    },
    {
      name: "시간과 종일이 함께 오면 시간을 따른다",
      patch: { scheduledLocalTime: LOCAL, isAllDay: true },
      time: TIME,
      allDay: false,
    },
  ])("부분 수정에서 $name", ({ patch, time, allDay }) => {
    // Given
    const schedule = TodoSchedule.create({
      startDate: START,
      endDate: null,
      scheduledLocalTime: LOCAL,
      isAllDay: false,
      timezone: ZONE,
    });
    // When
    const patched = schedule.patch(patch, ZONE);
    // Then
    expect(patched.scheduledTime).toEqual(time);
    expect(patched.isAllDay).toBe(allDay);
  });

  it("날짜만 옮기면 저장된 옛 종일+시간 행의 종일 값은 그대로이고 순간은 새 날짜로 간다", () => {
    // Given
    const legacy = TodoSchedule.reconstitute({
      startDate: START,
      endDate: null,
      scheduledLocalTime: LOCAL,
      scheduledTime: TIME,
      isAllDay: true,
    });
    // When
    const patched = legacy.patch({ startDate: Temporal.PlainDate.from("2026-03-02") }, ZONE);
    // Then
    expect(patched.isAllDay).toBe(true);
    expect(patched.scheduledLocalTime).toBe(LOCAL);
    expect(patched.scheduledTime).toEqual(Temporal.Instant.from("2026-03-02T06:00:00.000Z"));
  });

  it("날짜를 옮기면 고른 벽시계가 그대로이고 그 날짜의 오프셋으로 순간을 다시 만든다", () => {
    // Given
    const schedule = TodoSchedule.create({
      startDate: Temporal.PlainDate.from("2026-03-07"),
      endDate: null,
      scheduledLocalTime: "10:00",
      isAllDay: false,
      timezone: "America/New_York",
    });
    // When
    const patched = schedule.patch(
      { startDate: Temporal.PlainDate.from("2026-03-09") },
      "America/New_York",
    );
    // Then
    expect(schedule.scheduledTime).toEqual(Temporal.Instant.from("2026-03-07T15:00:00.000Z"));
    expect(patched.scheduledLocalTime).toBe("10:00");
    expect(patched.scheduledTime).toEqual(Temporal.Instant.from("2026-03-09T14:00:00.000Z"));
  });

  it("날짜·시간을 건드리지 않는 수정은 지난 시간대로 만든 순간을 바꾸지 않는다", () => {
    // Given
    const schedule = TodoSchedule.create({
      startDate: START,
      endDate: null,
      scheduledLocalTime: LOCAL,
      isAllDay: false,
      timezone: "Asia/Seoul",
    });
    // When
    const patched = schedule.patch(
      { endDate: Temporal.PlainDate.from("2026-03-02") },
      "America/New_York",
    );
    // Then
    expect(patched.scheduledTime).toEqual(schedule.scheduledTime);
  });

  it("옛 서버가 시간을 지워 칸만 낡은 행은 벽시계도 없는 것으로 읽는다", () => {
    // Given
    const props = {
      startDate: START,
      endDate: null,
      scheduledLocalTime: LOCAL,
      scheduledTime: null,
      isAllDay: true,
    };
    // When
    const schedule = TodoSchedule.reconstitute(props);
    // Then
    expect(schedule.scheduledLocalTime).toBeNull();
  });

  it("옛 서버가 써서 칸이 빈 행은 순간을 지금 시간대로 읽어 날짜를 옮겨도 보던 시각이 된다", () => {
    // Given
    const legacy = TodoSchedule.reconstitute({
      startDate: START,
      endDate: null,
      scheduledLocalTime: null,
      scheduledTime: Temporal.Instant.from("2026-03-01T01:00:00.000Z"),
      isAllDay: false,
    });
    // When
    const patched = legacy.patch(
      { startDate: Temporal.PlainDate.from("2026-03-02") },
      "Asia/Seoul",
    );
    // Then
    expect(legacy.localTimeIn("Asia/Seoul")).toBe("10:00");
    expect(patched.scheduledLocalTime).toBe("10:00");
    expect(patched.scheduledTime).toEqual(Temporal.Instant.from("2026-03-02T01:00:00.000Z"));
  });

  it("유효한 일정으로 생성하면 각 필드를 그대로 노출한다", () => {
    // Given
    const startDate = Temporal.PlainDate.from("2026-03-01");
    const endDate = Temporal.PlainDate.from("2026-03-05");
    const scheduledTime = Temporal.Instant.from("2026-03-01T06:00:00.000Z");

    // When
    const schedule = TodoSchedule.create({
      startDate,
      endDate,
      scheduledLocalTime: "06:00",
      isAllDay: false,
      timezone: "UTC",
    });

    // Then
    expect(schedule.startDate).toEqual(startDate);
    expect(schedule.endDate).toEqual(endDate);
    expect(schedule.scheduledTime).toEqual(scheduledTime);
    expect(schedule.isAllDay).toBe(false);
  });

  it("endDate가 null이면 단일 날짜 일정으로 생성된다", () => {
    // Given & When
    const schedule = TodoSchedule.create({
      startDate: Temporal.PlainDate.from("2026-03-01"),
      endDate: null,
      scheduledLocalTime: null,
      isAllDay: true,
      timezone: "UTC",
    });

    // Then
    expect(schedule.endDate).toBeNull();
    expect(schedule.scheduledTime).toBeNull();
  });

  it("endDate가 startDate보다 빠르면 DomainException(SYS_0002)을 던진다", () => {
    // Given - 역전된 날짜 범위
    const create = () =>
      TodoSchedule.create({
        startDate: Temporal.PlainDate.from("2026-03-05"),
        endDate: Temporal.PlainDate.from("2026-03-01"),
        scheduledLocalTime: null,
        isAllDay: true,
        timezone: "UTC",
      });

    // When & Then
    expect(create).toThrow(DomainException);
    expect(create).toThrow("종료 날짜는 시작 날짜보다 빠를 수 없습니다.");
    try {
      create();
    } catch (error) {
      if (error instanceof DomainException) {
        expect(error.errorCode).toBe(ErrorCode.SYS_0002);
      }
    }
  });

  it("endDate와 startDate가 같으면 허용한다 (경계값)", () => {
    // Given & When
    const sameDay = Temporal.PlainDate.from("2026-03-01");
    const schedule = TodoSchedule.create({
      startDate: sameDay,
      endDate: sameDay,
      scheduledLocalTime: null,
      isAllDay: true,
      timezone: "UTC",
    });

    // Then
    expect(schedule.endDate).toEqual(sameDay);
  });

  describe("reconstitute", () => {
    it("역전된 날짜 범위도 재검증 없이 복원한다 (가드 도입 이전 데이터 보호)", () => {
      // Given - 불변식을 위반하는 저장 데이터
      const schedule = TodoSchedule.reconstitute({
        startDate: Temporal.PlainDate.from("2026-03-05"),
        endDate: Temporal.PlainDate.from("2026-03-01"),
        scheduledLocalTime: null,
        scheduledTime: null,
        isAllDay: true,
      });

      // When & Then - 복원은 항상 성공하고 값을 그대로 노출한다
      expect(schedule.startDate).toEqual(Temporal.PlainDate.from("2026-03-05"));
      expect(schedule.endDate).toEqual(Temporal.PlainDate.from("2026-03-01"));
    });
  });

  describe("patch", () => {
    it("undefined 키는 기존 값을 유지하고 전달된 키만 머지한 새 VO를 반환한다", () => {
      // Given
      const base = TodoSchedule.create({
        startDate: Temporal.PlainDate.from("2026-03-01"),
        endDate: Temporal.PlainDate.from("2026-03-05"),
        scheduledLocalTime: null,
        isAllDay: true,
        timezone: "UTC",
      });

      // When - 시간/isAllDay만 패치
      const scheduledTime = Temporal.Instant.from("2026-03-01T06:00:00.000Z");
      const patched = base.patch({ scheduledLocalTime: "06:00", isAllDay: false }, "UTC");

      // Then - 날짜는 유지, 시간·종일 여부만 변경 (원본 VO는 불변)
      expect(patched.startDate).toEqual(Temporal.PlainDate.from("2026-03-01"));
      expect(patched.endDate).toEqual(Temporal.PlainDate.from("2026-03-05"));
      expect(patched.scheduledTime).toEqual(scheduledTime);
      expect(patched.isAllDay).toBe(false);
      expect(base.scheduledTime).toBeNull();
      expect(base.isAllDay).toBe(true);
    });

    it("endDate: null 패치는 종료 날짜 제거로 반영된다 (undefined와 구분)", () => {
      // Given
      const base = TodoSchedule.create({
        startDate: Temporal.PlainDate.from("2026-03-01"),
        endDate: Temporal.PlainDate.from("2026-03-05"),
        scheduledLocalTime: null,
        isAllDay: true,
        timezone: "UTC",
      });

      // When
      const patched = base.patch({ endDate: null }, "UTC");

      // Then
      expect(patched.endDate).toBeNull();
    });

    it("날짜를 건드리는 패치는 머지 결과를 재검증해 역전이면 DomainException(SYS_0002)을 던진다", () => {
      // Given - startDate가 2026-03-01인 일정
      const base = TodoSchedule.create({
        startDate: Temporal.PlainDate.from("2026-03-01"),
        endDate: null,
        scheduledLocalTime: null,
        isAllDay: true,
        timezone: "UTC",
      });
      const patch = () => base.patch({ endDate: Temporal.PlainDate.from("2026-02-20") }, "UTC");

      // When & Then - 단일 필드 패치도 교차 검증
      expect(patch).toThrow(DomainException);
      try {
        patch();
      } catch (error) {
        if (error instanceof DomainException) {
          expect(error.errorCode).toBe(ErrorCode.SYS_0002);
        }
      }
    });

    it("시간만 바꾸는 패치는 재검증하지 않아 위반 상태의 기존 날짜가 살아남는다 (기존 API 동작 보존)", () => {
      // Given - 가드 도입 이전에 저장된 역전 날짜 데이터
      const legacyViolating = TodoSchedule.reconstitute({
        startDate: Temporal.PlainDate.from("2026-03-05"),
        endDate: Temporal.PlainDate.from("2026-03-01"),
        scheduledLocalTime: null,
        scheduledTime: null,
        isAllDay: true,
      });

      // When - 날짜를 건드리지 않는 패치
      const patched = legacyViolating.patch(
        { scheduledLocalTime: "09:00", isAllDay: false },
        "UTC",
      );

      // Then - 실패 없이 위반 날짜가 그대로 유지된다
      expect(patched.startDate).toEqual(Temporal.PlainDate.from("2026-03-05"));
      expect(patched.endDate).toEqual(Temporal.PlainDate.from("2026-03-01"));
      expect(patched.isAllDay).toBe(false);
    });
  });
});
