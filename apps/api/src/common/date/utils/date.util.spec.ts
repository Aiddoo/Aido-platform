import {
	getUserToday,
	startOfDayInTimezone,
	toDateString,
	toScheduledTime,
} from "./date.util";

describe("getUserToday", () => {
	it("KST 자정 이후에도 한국 날짜를 반환한다", () => {
		// Given - KST 2026-02-07 01:00 = UTC 2026-02-06 16:00
		jest.useFakeTimers().setSystemTime(new Date("2026-02-06T16:00:00Z"));

		// When
		const today = getUserToday("Asia/Seoul");

		// Then
		expect(toDateString(today)).toBe("2026-02-07");
		jest.useRealTimers();
	});

	it("UTC 기본값으로 동작한다", () => {
		// Given
		jest.useFakeTimers().setSystemTime(new Date("2026-02-06T23:00:00Z"));

		// When
		const today = getUserToday();

		// Then
		expect(toDateString(today)).toBe("2026-02-06");
		jest.useRealTimers();
	});

	it("미국 동부 시간대에서 정확한 날짜를 반환한다", () => {
		// Given - EST 2026-02-06 23:30 = UTC 2026-02-07 04:30
		jest.useFakeTimers().setSystemTime(new Date("2026-02-07T04:30:00Z"));

		// When
		const today = getUserToday("America/New_York");

		// Then
		expect(toDateString(today)).toBe("2026-02-06");
		jest.useRealTimers();
	});
});

describe("startOfDayInTimezone", () => {
	it("KST 타임존의 자정을 UTC로 변환한다", () => {
		// Given - KST 2026-02-07 05:00
		const date = new Date("2026-02-06T20:00:00Z");

		// When
		const result = startOfDayInTimezone(date, "Asia/Seoul");

		// Then
		expect(toDateString(result)).toBe("2026-02-07");
		expect(result.getUTCHours()).toBe(0);
		expect(result.getUTCMinutes()).toBe(0);
	});

	it("UTC 기본값으로 동작한다", () => {
		// Given
		const date = new Date("2026-02-06T15:30:00Z");

		// When
		const result = startOfDayInTimezone(date);

		// Then
		expect(toDateString(result)).toBe("2026-02-06");
		expect(result.getUTCHours()).toBe(0);
	});
});

describe("toScheduledTime", () => {
	it("KST 로컬 시간을 UTC로 변환한다", () => {
		// Given - KST 14:00 → UTC 05:00

		// When
		const result = toScheduledTime("2026-01-15", "14:00", "Asia/Seoul");

		// Then
		expect(result.toISOString()).toBe("2026-01-15T05:00:00.000Z");
	});

	it("EST 로컬 시간을 UTC로 변환한다", () => {
		// Given - EST 14:00 → UTC 19:00

		// When
		const result = toScheduledTime("2026-01-15", "14:00", "America/New_York");

		// Then
		expect(result.toISOString()).toBe("2026-01-15T19:00:00.000Z");
	});

	it("UTC 기본값으로 동작한다", () => {
		// Given & When
		const result = toScheduledTime("2026-01-15", "14:00");

		// Then
		expect(result.toISOString()).toBe("2026-01-15T14:00:00.000Z");
	});

	it("자정 근처 타임존 변환 시 날짜가 올바르게 처리된다", () => {
		// Given - KST 01:00 → UTC 이전 날 16:00

		// When
		const result = toScheduledTime("2026-01-15", "01:00", "Asia/Seoul");

		// Then
		expect(result.toISOString()).toBe("2026-01-14T16:00:00.000Z");
	});
});
