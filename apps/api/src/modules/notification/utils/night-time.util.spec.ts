import { NIGHT_TIME_CONFIG } from "@aido/validators";

import { getKstHour, isDayTime, isNightTime } from "./night-time.util";

describe("night-time.util", () => {
	describe("getKstHour", () => {
		it("UTC 0시는 KST 9시로 변환된다", () => {
			const date = new Date("2024-01-15T00:00:00Z");
			expect(getKstHour(date)).toBe(9);
		});

		it("UTC 12시는 KST 21시로 변환된다", () => {
			const date = new Date("2024-01-15T12:00:00Z");
			expect(getKstHour(date)).toBe(21);
		});

		it("UTC 15시는 KST 0시로 변환된다 (자정 넘김)", () => {
			const date = new Date("2024-01-15T15:00:00Z");
			expect(getKstHour(date)).toBe(0);
		});

		it("UTC 23시는 KST 8시로 변환된다", () => {
			const date = new Date("2024-01-15T23:00:00Z");
			expect(getKstHour(date)).toBe(8);
		});
	});

	describe("isNightTime", () => {
		// 야간 시간: KST 21:00 ~ 08:00 (START_HOUR=21, END_HOUR=8)

		describe("야간 시간대 (KST 21:00-23:59)", () => {
			it("KST 21:00은 야간이다", () => {
				// KST 21:00 = UTC 12:00
				const date = new Date("2024-01-15T12:00:00Z");
				expect(isNightTime(date)).toBe(true);
			});

			it("KST 22:30은 야간이다", () => {
				// KST 22:30 = UTC 13:30
				const date = new Date("2024-01-15T13:30:00Z");
				expect(isNightTime(date)).toBe(true);
			});

			it("KST 23:59은 야간이다", () => {
				// KST 23:59 = UTC 14:59
				const date = new Date("2024-01-15T14:59:00Z");
				expect(isNightTime(date)).toBe(true);
			});
		});

		describe("야간 시간대 (KST 00:00-07:59)", () => {
			it("KST 00:00은 야간이다", () => {
				// KST 00:00 = UTC 15:00 (전날)
				const date = new Date("2024-01-15T15:00:00Z");
				expect(isNightTime(date)).toBe(true);
			});

			it("KST 03:00은 야간이다", () => {
				// KST 03:00 = UTC 18:00 (전날)
				const date = new Date("2024-01-15T18:00:00Z");
				expect(isNightTime(date)).toBe(true);
			});

			it("KST 07:59은 야간이다", () => {
				// KST 07:59 = UTC 22:59 (전날)
				const date = new Date("2024-01-15T22:59:00Z");
				expect(isNightTime(date)).toBe(true);
			});
		});

		describe("주간 시간대 (KST 08:00-20:59)", () => {
			it("KST 08:00은 주간이다", () => {
				// KST 08:00 = UTC 23:00 (전날)
				const date = new Date("2024-01-15T23:00:00Z");
				expect(isNightTime(date)).toBe(false);
			});

			it("KST 12:00은 주간이다", () => {
				// KST 12:00 = UTC 03:00
				const date = new Date("2024-01-15T03:00:00Z");
				expect(isNightTime(date)).toBe(false);
			});

			it("KST 20:00은 주간이다", () => {
				// KST 20:00 = UTC 11:00
				const date = new Date("2024-01-15T11:00:00Z");
				expect(isNightTime(date)).toBe(false);
			});

			it("KST 20:59은 주간이다", () => {
				// KST 20:59 = UTC 11:59
				const date = new Date("2024-01-15T11:59:00Z");
				expect(isNightTime(date)).toBe(false);
			});
		});

		it("인자 없이 호출하면 현재 시간을 사용한다", () => {
			// 현재 시간을 mock하지 않고 함수가 오류 없이 실행되는지 확인
			const result = isNightTime();
			expect(typeof result).toBe("boolean");
		});
	});

	describe("isDayTime", () => {
		it("isNightTime의 반대값을 반환한다", () => {
			// KST 12:00 (주간) = UTC 03:00
			const dayDate = new Date("2024-01-15T03:00:00Z");
			expect(isDayTime(dayDate)).toBe(true);
			expect(isDayTime(dayDate)).toBe(!isNightTime(dayDate));

			// KST 02:00 (야간) = UTC 17:00
			const nightDate = new Date("2024-01-15T17:00:00Z");
			expect(isDayTime(nightDate)).toBe(false);
			expect(isDayTime(nightDate)).toBe(!isNightTime(nightDate));
		});

		it("인자 없이 호출하면 현재 시간을 사용한다", () => {
			const result = isDayTime();
			expect(typeof result).toBe("boolean");
		});
	});

	describe("NIGHT_TIME_CONFIG 상수 확인", () => {
		it("시작 시간은 21시다", () => {
			expect(NIGHT_TIME_CONFIG.START_HOUR).toBe(21);
		});

		it("종료 시간은 8시다", () => {
			expect(NIGHT_TIME_CONFIG.END_HOUR).toBe(8);
		});

		it("KST 오프셋은 9시간이다", () => {
			expect(NIGHT_TIME_CONFIG.KST_OFFSET_HOURS).toBe(9);
		});
	});
});
