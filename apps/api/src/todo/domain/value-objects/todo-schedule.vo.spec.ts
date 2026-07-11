/**
 * TodoSchedule VO 단위 테스트
 *
 * GWT 패턴 — 날짜 불변식 검증
 */

import { ErrorCode } from "@aido/errors";
import { DomainException } from "@/shared/domain";
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

	it("getter가 반환한 Date를 변조해도 이후 조회 값은 영향받지 않는다 (방어 복사)", () => {
		// Given
		const schedule = TodoSchedule.create({
			startDate: new Date("2026-03-01"),
			endDate: new Date("2026-03-05"),
			scheduledTime: new Date("2026-03-01T06:00:00.000Z"),
			isAllDay: false,
		});

		// When - 반환된 Date를 임의로 변조
		schedule.getStartDate().setFullYear(1999);
		schedule.getEndDate()?.setFullYear(1999);
		schedule.getScheduledTime()?.setFullYear(1999);

		// Then - 내부 값은 불변
		expect(schedule.getStartDate()).toEqual(new Date("2026-03-01"));
		expect(schedule.getEndDate()).toEqual(new Date("2026-03-05"));
		expect(schedule.getScheduledTime()).toEqual(
			new Date("2026-03-01T06:00:00.000Z"),
		);
	});

	it("getValue()가 반환한 props를 변조해도 이후 조회 값은 영향받지 않는다 (방어 복사)", () => {
		// Given
		const schedule = TodoSchedule.create({
			startDate: new Date("2026-03-01"),
			endDate: new Date("2026-03-05"),
			scheduledTime: null,
			isAllDay: true,
		});

		// When - 반환된 props의 Date를 임의로 변조
		const value = schedule.getValue();
		value.startDate.setFullYear(1999);
		value.endDate?.setFullYear(1999);

		// Then - 재조회 값은 불변
		expect(schedule.getValue().startDate).toEqual(new Date("2026-03-01"));
		expect(schedule.getValue().endDate).toEqual(new Date("2026-03-05"));
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

	describe("reconstitute", () => {
		it("역전된 날짜 범위도 재검증 없이 복원한다 (가드 도입 이전 데이터 보호)", () => {
			// Given - 불변식을 위반하는 저장 데이터
			const schedule = TodoSchedule.reconstitute({
				startDate: new Date("2026-03-05"),
				endDate: new Date("2026-03-01"),
				scheduledTime: null,
				isAllDay: true,
			});

			// When & Then - 복원은 항상 성공하고 값을 그대로 노출한다
			expect(schedule.getStartDate()).toEqual(new Date("2026-03-05"));
			expect(schedule.getEndDate()).toEqual(new Date("2026-03-01"));
		});
	});

	describe("patch", () => {
		it("undefined 키는 기존 값을 유지하고 전달된 키만 머지한 새 VO를 반환한다", () => {
			// Given
			const base = TodoSchedule.create({
				startDate: new Date("2026-03-01"),
				endDate: new Date("2026-03-05"),
				scheduledTime: null,
				isAllDay: true,
			});

			// When - scheduledTime/isAllDay만 패치
			const scheduledTime = new Date("2026-03-01T06:00:00.000Z");
			const patched = base.patch({ scheduledTime, isAllDay: false });

			// Then - 날짜는 유지, 시간·종일 여부만 변경 (원본 VO는 불변)
			expect(patched.getStartDate()).toEqual(new Date("2026-03-01"));
			expect(patched.getEndDate()).toEqual(new Date("2026-03-05"));
			expect(patched.getScheduledTime()).toEqual(scheduledTime);
			expect(patched.isAllDay()).toBe(false);
			expect(base.getScheduledTime()).toBeNull();
			expect(base.isAllDay()).toBe(true);
		});

		it("endDate: null 패치는 종료 날짜 제거로 반영된다 (undefined와 구분)", () => {
			// Given
			const base = TodoSchedule.create({
				startDate: new Date("2026-03-01"),
				endDate: new Date("2026-03-05"),
				scheduledTime: null,
				isAllDay: true,
			});

			// When
			const patched = base.patch({ endDate: null });

			// Then
			expect(patched.getEndDate()).toBeNull();
		});

		it("날짜를 건드리는 패치는 머지 결과를 재검증해 역전이면 DomainException(SYS_0002)을 던진다", () => {
			// Given - startDate가 2026-03-01인 일정
			const base = TodoSchedule.create({
				startDate: new Date("2026-03-01"),
				endDate: null,
				scheduledTime: null,
				isAllDay: true,
			});
			const patch = () => base.patch({ endDate: new Date("2026-02-20") });

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
				startDate: new Date("2026-03-05"),
				endDate: new Date("2026-03-01"),
				scheduledTime: null,
				isAllDay: true,
			});

			// When - 날짜를 건드리지 않는 패치
			const patched = legacyViolating.patch({
				scheduledTime: new Date("2026-03-05T09:00:00.000Z"),
				isAllDay: false,
			});

			// Then - 실패 없이 위반 날짜가 그대로 유지된다
			expect(patched.getStartDate()).toEqual(new Date("2026-03-05"));
			expect(patched.getEndDate()).toEqual(new Date("2026-03-01"));
			expect(patched.isAllDay()).toBe(false);
		});
	});
});
