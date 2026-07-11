/**
 * weekly-achievement 도메인 순수 계산 단위 테스트
 *
 * 주차 라벨·날짜 범위·streak·요약·뷰 변환·불변식을 검증한다.
 */
import {
	buildWeeklyAchievementSnapshot,
	computeDateRange,
	computeStreak,
	computeSummary,
	computeWeekLabel,
	toWeeklyAchievementView,
	type WeeklyAchievementRecord,
	type WeeklyAchievementRow,
	type WeeklyAchievementUpsert,
} from "./weekly-achievement";

function row(overrides?: Partial<WeeklyAchievementRow>): WeeklyAchievementRow {
	return {
		id: 1,
		year: 2026,
		week: 1,
		totalTodos: 10,
		completedTodos: 8,
		achievedAt: new Date("2026-01-05T11:00:00.000Z"),
		...overrides,
	};
}

describe("weekly-achievement 도메인", () => {
	describe("computeWeekLabel — en 로케일", () => {
		it("en 라벨은 'Week N of MMM' 형식이다 (모바일 캘린더 표기와 일치)", () => {
			expect(computeWeekLabel(2026, 10, "en")).toBe("Week 1 of Mar");
		});

		it("locale 생략 시 한국어 라벨을 유지한다 (하위 호환)", () => {
			expect(computeWeekLabel(2026, 10)).toBe("3월 1주차");
		});
	});

	describe("computeWeekLabel", () => {
		it("일반 주차의 라벨을 생성한다", () => {
			const label = computeWeekLabel(2026, 10);
			expect(label).toMatch(/^\d+월 \d+주차$/);
			expect(label).toContain("3월");
		});

		it("연초 주차의 라벨을 생성한다", () => {
			expect(computeWeekLabel(2026, 1)).toMatch(/^\d+월 \d+주차$/);
		});

		it("연말 주차의 라벨을 생성한다", () => {
			expect(computeWeekLabel(2025, 52)).toMatch(/^\d+월 \d+주차$/);
		});
	});

	describe("computeDateRange", () => {
		it("월요일~일요일 범위를 반환한다", () => {
			const range = computeDateRange(2026, 10);
			expect(range.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(range.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

			const start = new Date(range.startDate);
			const end = new Date(range.endDate);
			const diffDays =
				(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
			expect(diffDays).toBe(6);
		});

		it("2026년 10주차의 정확한 날짜를 반환한다", () => {
			const range = computeDateRange(2026, 10);
			expect(range.startDate).toBe("2026-03-02");
			expect(range.endDate).toBe("2026-03-08");
		});
	});

	describe("computeStreak", () => {
		it("빈 배열이면 0을 반환한다", () => {
			expect(computeStreak([])).toEqual({ currentStreak: 0, bestStreak: 0 });
		});

		it("단일 레코드면 streak은 1이다", () => {
			expect(computeStreak([{ year: 2026, week: 5 }])).toEqual({
				currentStreak: 1,
				bestStreak: 1,
			});
		});

		it("연속 주차의 streak을 계산한다", () => {
			const records: WeeklyAchievementRecord[] = [
				{ year: 2026, week: 5 },
				{ year: 2026, week: 6 },
				{ year: 2026, week: 7 },
			];
			expect(computeStreak(records)).toEqual({
				currentStreak: 3,
				bestStreak: 3,
			});
		});

		it("중간에 빈 주가 있으면 streak이 끊긴다", () => {
			const records: WeeklyAchievementRecord[] = [
				{ year: 2026, week: 5 },
				{ year: 2026, week: 6 },
				// week 7 missing
				{ year: 2026, week: 8 },
				{ year: 2026, week: 9 },
				{ year: 2026, week: 10 },
			];
			const result = computeStreak(records);
			expect(result.currentStreak).toBe(3); // 8, 9, 10
			expect(result.bestStreak).toBe(3); // 8, 9, 10
		});

		it("연말→연초 경계를 처리한다", () => {
			const records: WeeklyAchievementRecord[] = [
				{ year: 2025, week: 51 },
				{ year: 2025, week: 52 },
				{ year: 2026, week: 1 },
				{ year: 2026, week: 2 },
			];
			const result = computeStreak(records);
			expect(result.currentStreak).toBe(4);
			expect(result.bestStreak).toBe(4);
		});

		it("bestStreak과 currentStreak이 다를 수 있다", () => {
			const records: WeeklyAchievementRecord[] = [
				{ year: 2026, week: 1 },
				{ year: 2026, week: 2 },
				{ year: 2026, week: 3 },
				{ year: 2026, week: 4 }, // bestStreak = 4
				// gap
				{ year: 2026, week: 8 },
				{ year: 2026, week: 9 }, // currentStreak = 2
			];
			const result = computeStreak(records);
			expect(result.currentStreak).toBe(2);
			expect(result.bestStreak).toBe(4);
		});

		it("53주차 연도의 연말→연초 경계를 처리한다", () => {
			// 2020년은 53 ISO weeks
			const records: WeeklyAchievementRecord[] = [
				{ year: 2020, week: 52 },
				{ year: 2020, week: 53 },
				{ year: 2021, week: 1 },
			];
			const result = computeStreak(records);
			expect(result.currentStreak).toBe(3);
			expect(result.bestStreak).toBe(3);
		});
	});

	describe("computeSummary", () => {
		it("빈 배열이면 모든 값이 0이다", () => {
			expect(computeSummary([])).toEqual({
				totalWeeks: 0,
				perfectWeeks: 0,
				currentStreak: 0,
				bestStreak: 0,
				averageRate: 0,
			});
		});

		it("통계를 정확하게 계산한다", () => {
			const rows = [
				row({ year: 2026, week: 1, totalTodos: 10, completedTodos: 10 }), // 100%
				row({ year: 2026, week: 2, totalTodos: 10, completedTodos: 8 }), // 80%
				row({ year: 2026, week: 3, totalTodos: 10, completedTodos: 10 }), // 100%
			];
			const summary = computeSummary(rows);
			expect(summary.totalWeeks).toBe(3);
			expect(summary.perfectWeeks).toBe(2);
			expect(summary.averageRate).toBe(93); // (100+80+100)/3 = 93.33 → 93
			expect(summary.currentStreak).toBe(3);
			expect(summary.bestStreak).toBe(3);
		});
	});

	describe("toWeeklyAchievementView", () => {
		it("레코드를 응답 뷰로 변환한다", () => {
			const view = toWeeklyAchievementView(
				row({
					id: 42,
					year: 2026,
					week: 10,
					totalTodos: 15,
					completedTodos: 14,
					achievedAt: new Date("2026-03-08T11:00:00.000Z"),
				}),
			);
			expect(view.id).toBe(42);
			expect(view.year).toBe(2026);
			expect(view.week).toBe(10);
			expect(view.weekLabel).toMatch(/\d+월 \d+주차/);
			expect(view.dateRange.startDate).toBe("2026-03-02");
			expect(view.dateRange.endDate).toBe("2026-03-08");
			expect(view.totalTodos).toBe(15);
			expect(view.completedTodos).toBe(14);
			expect(view.completionRate).toBe(93);
			expect(view.achievedAt).toBe("2026-03-08T11:00:00.000Z");
		});

		it("totalTodos가 0이면 completionRate는 0이다", () => {
			const view = toWeeklyAchievementView(
				row({ totalTodos: 0, completedTodos: 0 }),
			);
			expect(view.completionRate).toBe(0);
		});
	});

	describe("buildWeeklyAchievementSnapshot — 불변식", () => {
		function upsert(
			overrides?: Partial<WeeklyAchievementUpsert>,
		): WeeklyAchievementUpsert {
			return {
				userId: "user-1",
				year: 2026,
				week: 10,
				totalTodos: 5,
				completedTodos: 3,
				achievedAt: new Date("2026-03-09T00:00:00.000Z"),
				...overrides,
			};
		}

		it("유효한 입력은 그대로 통과시킨다", () => {
			const input = upsert();
			expect(buildWeeklyAchievementSnapshot(input)).toEqual(input);
		});

		it("완료 수가 전체 수를 초과하면 SYS_0002로 실패한다", () => {
			expect(() =>
				buildWeeklyAchievementSnapshot(
					upsert({ totalTodos: 2, completedTodos: 5 }),
				),
			).toThrow();
		});

		it("주차가 ISO 범위를 벗어나면 SYS_0002로 실패한다", () => {
			expect(() =>
				buildWeeklyAchievementSnapshot(upsert({ week: 54 })),
			).toThrow();
		});
	});
});
