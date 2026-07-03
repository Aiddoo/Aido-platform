/**
 * TodoSchedule VO 단위 테스트
 *
 * GWT 패턴 — 날짜 불변식 검증
 */

import { ErrorCode } from "@aido/errors";
import { DomainException } from "@/common/domain";
import { TodoSchedule } from "./todo-schedule.vo";

describe("TodoSchedule — 일정 값 객체", () => {
	it("유효한 일정으로 생성하면 각 필드를 그대로 노출한다", () => {
		// Given
		const startDate = new Date("2026-03-01");
		const endDate = new Date("2026-03-05");
		const scheduledTime = new Date("2026-03-01T06:00:00.000Z");

		// When
		const schedule = TodoSchedule.create({
			startDate,
			endDate,
			scheduledTime,
			isAllDay: false,
		});

		// Then
		expect(schedule.getStartDate()).toEqual(startDate);
		expect(schedule.getEndDate()).toEqual(endDate);
		expect(schedule.getScheduledTime()).toEqual(scheduledTime);
		expect(schedule.isAllDay()).toBe(false);
	});

	it("endDate가 null이면 단일 날짜 일정으로 생성된다", () => {
		// Given & When
		const schedule = TodoSchedule.create({
			startDate: new Date("2026-03-01"),
			endDate: null,
			scheduledTime: null,
			isAllDay: true,
		});

		// Then
		expect(schedule.getEndDate()).toBeNull();
		expect(schedule.getScheduledTime()).toBeNull();
	});

	it("endDate가 startDate보다 빠르면 DomainException(SYS_0002)을 던진다", () => {
		// Given - 역전된 날짜 범위
		const create = () =>
			TodoSchedule.create({
				startDate: new Date("2026-03-05"),
				endDate: new Date("2026-03-01"),
				scheduledTime: null,
				isAllDay: true,
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
		const sameDay = new Date("2026-03-01");
		const schedule = TodoSchedule.create({
			startDate: sameDay,
			endDate: sameDay,
			scheduledTime: null,
			isAllDay: true,
		});

		// Then
		expect(schedule.getEndDate()).toEqual(sameDay);
	});
});
