/**
 * SuggestionContextBuilder 단위 테스트
 *
 * build(): 병렬 데이터 수집, WeatherForecastAccess 실패 graceful degradation, 스트릭 정보 없음
 * detectMissingRoutines(): 빠뜨린 루틴 감지, 이번 주 존재 시 무시, 2회 미만 무시
 *
 * @execute pnpm --filter @aido/api test -- suggestion-context.builder.spec
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

import { WeatherForecastAccess } from "@/weather";

import type { DayCompletionRate, TodoSummaryForAnalysis } from "../../domain/types";
import {
	AI_SUGGESTION_REPOSITORY,
	type AiSuggestionRepositoryPort,
} from "../ports/ai-suggestion.repository.port";
import {
	WEEKLY_REPORT_READER,
	type WeeklyReportReaderPort,
} from "../ports/weekly-report-reader.port";
import { SuggestionContextBuilder } from "./suggestion-context.builder";

dayjs.extend(utc);
dayjs.extend(timezone);

// now()를 고정하여 테스트 안정성 확보 (now()는 dayjs.utc().toDate() → Date.now()를
// 읽으므로 fake timers로 제어 가능)
const FIXED_NOW = new Date("2026-03-31T06:00:00.000Z");

describe("SuggestionContextBuilder — AI 제안 컨텍스트 빌더", () => {
	let builder: SuggestionContextBuilder;
	let mockRepository: Mocked<AiSuggestionRepositoryPort>;
	let mockWeatherService: Mocked<WeatherForecastAccess>;
	let mockReportReader: Mocked<WeeklyReportReaderPort>;

	const mockUserId = "user-123";
	const mockTimezone = "Asia/Seoul";

	beforeEach(async () => {
		jest.useFakeTimers({ now: FIXED_NOW });

		const { unit, unitRef } = await TestBed.solitary(SuggestionContextBuilder).compile();

		builder = unit;
		mockRepository = unitRef.get(AI_SUGGESTION_REPOSITORY);
		mockWeatherService = unitRef.get(WeatherForecastAccess);
		mockReportReader = unitRef.get(WEEKLY_REPORT_READER);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe("build", () => {
		const defaultTodos: TodoSummaryForAnalysis[] = [
			{
				title: "운동",
				startDate: "2026-03-24",
				scheduledTime: "09:00",
				categoryId: 1,
				completed: true,
				categoryName: "건강",
			},
		];

		const defaultDayRates: DayCompletionRate[] = [
			{ day: "MON", total: 10, completed: 8 },
			{ day: "TUE", total: 5, completed: 3 },
			{ day: "WED", total: 7, completed: 5 },
			{ day: "THU", total: 6, completed: 4 },
			{ day: "FRI", total: 8, completed: 6 },
			{ day: "SAT", total: 3, completed: 2 },
			{ day: "SUN", total: 2, completed: 1 },
		];

		const defaultTimeRates = {
			morning: { count: 10, rate: 60 },
			afternoon: { count: 7, rate: 40 },
		};

		const defaultCategoryRates = [
			{ name: "건강", total: 10, completed: 8, rate: 80 },
			{ name: "업무", total: 5, completed: 3, rate: 60 },
		];

		const defaultStreakInfo = { currentStreak: 5, longestStreak: 12 };

		function setupDefaultMocks(): void {
			mockRepository.findRecentTodos.mockResolvedValue(defaultTodos);
			mockRepository.findDayCompletionRates.mockResolvedValue(defaultDayRates);
			mockRepository.findTimeCompletionRates.mockResolvedValue(defaultTimeRates);
			mockRepository.findCategoryCompletionRates.mockResolvedValue(defaultCategoryRates);
			mockRepository.findUserStreakInfo.mockResolvedValue(defaultStreakInfo);
			mockRepository.findRecentResponded.mockResolvedValue([]);
			mockReportReader.findLatestWeekly.mockResolvedValue(null);
			mockWeatherService.getForecastsByGridBatch.mockResolvedValue(
				new Map([
					[
						"60:127",
						{
							date: FIXED_NOW,
							skyCondition: "CLEAR",
							precipitationType: "NONE",
							precipitationProbability: 0,
							temperatureMin: 5,
							temperatureMax: 15,
							humidity: 50,
							windSpeed: 3,
							hourlyForecasts: [],
							dailyForecasts: [],
						},
					],
				]),
			);
		}

		const mockGrid = { gridX: 60, gridY: 127, lat: 37.5, lon: 127.0 };

		it("병렬 데이터 수집 후 SuggestionContext를 반환해야 한다", async () => {
			// Given - 모든 repository 메서드와 weather 서비스 mock 설정
			setupDefaultMocks();

			// When - build 호출 (grid 전달 시 날씨 조회)
			const result = await builder.build(mockUserId, mockTimezone, mockGrid);

			// Then - SuggestionContext 형태 검증
			expect(result.todos).toEqual(defaultTodos);
			expect(result.dayCompletionRates).toContain("월:");
			expect(result.dayCompletionRates).toContain("%");
			expect(result.timeCompletionRates).toContain("오전");
			expect(result.timeCompletionRates).toContain("오후");
			expect(result.categoryRates).toContain("건강:80%");
			expect(result.categoryRates).toContain("업무:60%");
			expect(result.streak).toBe("현재 5일 연속, 최장 12일");
			expect(result.weather).toBe("맑음, 5~15°C");
			expect(result.currentDate).toContain("2026-03-31");
			expect(Array.isArray(result.missingRoutines)).toBe(true);
		});

		it("WeatherForecastAccess 실패 시 weather=null로 graceful degradation", async () => {
			// Given - weather 서비스가 에러를 던지도록 설정
			setupDefaultMocks();
			mockWeatherService.getForecastsByGridBatch.mockRejectedValue(new Error("Redis 연결 실패"));

			// When - build 호출 (grid 전달했지만 서비스 에러)
			const result = await builder.build(mockUserId, mockTimezone, mockGrid);

			// Then - weather만 null이고 나머지는 정상
			expect(result.weather).toBeNull();
			expect(result.todos).toEqual(defaultTodos);
			expect(result.streak).toBe("현재 5일 연속, 최장 12일");
		});

		it("UserPreference 없을 때 스트릭을 '정보 없음'으로 반환해야 한다", async () => {
			// Given - findUserStreakInfo가 null 반환
			setupDefaultMocks();
			mockRepository.findUserStreakInfo.mockResolvedValue(null);

			// When - build 호출
			const result = await builder.build(mockUserId, mockTimezone, null);

			// Then - streak이 '정보 없음'
			expect(result.streak).toBe("정보 없음");
		});
	});

	describe("detectMissingRoutines", () => {
		// 이번 주 월요일: 2026-03-30 (FIXED_NOW=2026-03-31 화요일 기준)
		// 이전 주 월요일들을 기반으로 테스트 데이터 생성

		function createTodo(title: string, startDate: string): TodoSummaryForAnalysis {
			return {
				title,
				startDate,
				scheduledTime: null,
				categoryId: 1,
				completed: true,
				categoryName: "기본",
			};
		}

		it("정기 활동이 이번 주에 빠진 경우 감지해야 한다", () => {
			// Given - "운동"이 지난 2주 월요일에 등장했지만 이번 주에는 없음
			const todos: TodoSummaryForAnalysis[] = [
				createTodo("운동", "2026-03-16"), // 2주 전 월요일
				createTodo("운동", "2026-03-23"), // 1주 전 월요일
			];

			// When - 빠뜨린 루틴 감지
			const result = builder.detectMissingRoutines(todos, mockTimezone);

			// Then - "운동"이 빠뜨린 루틴으로 감지됨
			expect(result).toHaveLength(1);
			expect(result[0]).toContain("운동");
			expect(result[0]).toContain("월요일");
		});

		it("이번 주 이미 한 경우 빠뜨린 루틴으로 감지하지 않아야 한다", () => {
			// Given - "운동"이 지난 2주 월요일 + 이번 주에도 등장
			const todos: TodoSummaryForAnalysis[] = [
				createTodo("운동", "2026-03-16"), // 2주 전 월요일
				createTodo("운동", "2026-03-23"), // 1주 전 월요일
				createTodo("운동", "2026-03-30"), // 이번 주 월요일
			];

			// When - 빠뜨린 루틴 감지
			const result = builder.detectMissingRoutines(todos, mockTimezone);

			// Then - 빠뜨린 루틴 없음
			expect(result).toHaveLength(0);
		});

		it("2회 미만 등장 활동은 무시해야 한다", () => {
			// Given - "독서"가 1회만 등장 (패턴 아님)
			const todos: TodoSummaryForAnalysis[] = [
				createTodo("독서", "2026-03-16"), // 1회만 등장
			];

			// When - 빠뜨린 루틴 감지
			const result = builder.detectMissingRoutines(todos, mockTimezone);

			// Then - 빠뜨린 루틴 없음 (2회 미만이므로 무시)
			expect(result).toHaveLength(0);
		});
	});
});
