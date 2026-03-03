import { NIGHT_TIME_CONFIG } from "@aido/validators";

import { isDayTime, isNightTime } from "./night-time.util";

describe("night-time.util", () => {
	const KST = "Asia/Seoul";

	describe("isNightTime", () => {
		// 야간 시간: 로컬 21:00 ~ 08:00 (START_HOUR=21, END_HOUR=8)

		describe("야간 시간대 (KST 21:00-23:59)", () => {
			it("KST 21:00은 야간이다", () => {
				// Given - KST 21:00 = UTC 12:00
				const date = new Date("2024-01-15T12:00:00Z");

				// When & Then
				expect(isNightTime(KST, date)).toBe(true);
			});

			it("KST 22:30은 야간이다", () => {
				// Given - KST 22:30 = UTC 13:30
				const date = new Date("2024-01-15T13:30:00Z");

				// When & Then
				expect(isNightTime(KST, date)).toBe(true);
			});

			it("KST 23:59은 야간이다", () => {
				// Given - KST 23:59 = UTC 14:59
				const date = new Date("2024-01-15T14:59:00Z");

				// When & Then
				expect(isNightTime(KST, date)).toBe(true);
			});
		});

		describe("야간 시간대 (KST 00:00-07:59)", () => {
			it("KST 00:00은 야간이다", () => {
				// Given - KST 00:00 = UTC 15:00 (전날)
				const date = new Date("2024-01-15T15:00:00Z");

				// When & Then
				expect(isNightTime(KST, date)).toBe(true);
			});

			it("KST 03:00은 야간이다", () => {
				// Given - KST 03:00 = UTC 18:00 (전날)
				const date = new Date("2024-01-15T18:00:00Z");

				// When & Then
				expect(isNightTime(KST, date)).toBe(true);
			});

			it("KST 07:59은 야간이다", () => {
				// Given - KST 07:59 = UTC 22:59 (전날)
				const date = new Date("2024-01-15T22:59:00Z");

				// When & Then
				expect(isNightTime(KST, date)).toBe(true);
			});
		});

		describe("주간 시간대 (KST 08:00-20:59)", () => {
			it("KST 08:00은 주간이다", () => {
				// Given - KST 08:00 = UTC 23:00 (전날)
				const date = new Date("2024-01-15T23:00:00Z");

				// When & Then
				expect(isNightTime(KST, date)).toBe(false);
			});

			it("KST 12:00은 주간이다", () => {
				// Given - KST 12:00 = UTC 03:00
				const date = new Date("2024-01-15T03:00:00Z");

				// When & Then
				expect(isNightTime(KST, date)).toBe(false);
			});

			it("KST 20:00은 주간이다", () => {
				// Given - KST 20:00 = UTC 11:00
				const date = new Date("2024-01-15T11:00:00Z");

				// When & Then
				expect(isNightTime(KST, date)).toBe(false);
			});

			it("KST 20:59은 주간이다", () => {
				// Given - KST 20:59 = UTC 11:59
				const date = new Date("2024-01-15T11:59:00Z");

				// When & Then
				expect(isNightTime(KST, date)).toBe(false);
			});
		});

		describe("다른 타임존에서도 동작한다", () => {
			it("UTC 기준 21:00은 야간이다", () => {
				// Given
				const date = new Date("2024-01-15T21:00:00Z");

				// When & Then
				expect(isNightTime("UTC", date)).toBe(true);
			});

			it("UTC 기준 12:00은 주간이다", () => {
				// Given
				const date = new Date("2024-01-15T12:00:00Z");

				// When & Then
				expect(isNightTime("UTC", date)).toBe(false);
			});
		});

		it("인자 없이 호출하면 현재 시간을 사용한다", () => {
			// Given - 현재 시간을 mock하지 않고 함수가 오류 없이 실행되는지 확인

			// When
			const result = isNightTime();

			// Then
			expect(typeof result).toBe("boolean");
		});
	});

	describe("isDayTime", () => {
		it("isNightTime의 반대값을 반환한다", () => {
			// Given
			const dayDate = new Date("2024-01-15T03:00:00Z"); // KST 12:00 (주간)
			const nightDate = new Date("2024-01-15T17:00:00Z"); // KST 02:00 (야간)

			// When & Then
			expect(isDayTime(KST, dayDate)).toBe(true);
			expect(isDayTime(KST, dayDate)).toBe(!isNightTime(KST, dayDate));
			expect(isDayTime(KST, nightDate)).toBe(false);
			expect(isDayTime(KST, nightDate)).toBe(!isNightTime(KST, nightDate));
		});

		it("인자 없이 호출하면 현재 시간을 사용한다", () => {
			// Given - 현재 시간을 mock하지 않음

			// When
			const result = isDayTime();

			// Then
			expect(typeof result).toBe("boolean");
		});
	});

	describe("NIGHT_TIME_CONFIG 상수 확인", () => {
		it("시작 시간은 21시다", () => {
			// Given & When & Then
			expect(NIGHT_TIME_CONFIG.START_HOUR).toBe(21);
		});

		it("종료 시간은 8시다", () => {
			// Given & When & Then
			expect(NIGHT_TIME_CONFIG.END_HOUR).toBe(8);
		});
	});
});
