import { z } from "zod";
import type { ReportType } from "@/generated/prisma/client";
import type { AggregatedReportData } from "../types";

/**
 * AI 리포트 생성 응답 스키마
 */
export const reportAiResponseSchema = z.object({
	summary: z.string().describe("한국어로 작성된 주간/월간 요약 (3-5문장)"),
	tips: z
		.array(z.string())
		.min(1)
		.max(3)
		.describe("실천 가능한 팁 1-3개 (한국어)"),
});

export type ReportAiResponse = z.infer<typeof reportAiResponseSchema>;

// ============================================================================
// 파생 인사이트 계산
// ============================================================================

const DAY_KOREAN: Record<string, string> = {
	MON: "월요일",
	TUE: "화요일",
	WED: "수요일",
	THU: "목요일",
	FRI: "금요일",
	SAT: "토요일",
	SUN: "일요일",
};

const WEEKDAYS = new Set(["MON", "TUE", "WED", "THU", "FRI"]);

interface DerivedInsights {
	rateChange: number | null;
	rateDirection: "UP" | "DOWN" | "SAME" | null;
	bestCategory: { name: string; rate: number } | null;
	worstCategory: { name: string; rate: number } | null;
	bestDay: { day: string; rate: number } | null;
	worstDay: { day: string; rate: number } | null;
	avgDailyTodos: number;
	perfectDays: number;
	activeDays: number;
	weekdayRate: number;
	weekendRate: number;
	peakHour: { hour: number; count: number } | null;
	peakPeriod: string;
	topTimeSlots: { hour: number; count: number }[];
}

function computeDerivedInsights(data: AggregatedReportData): DerivedInsights {
	// 달성률 변화
	let rateChange: number | null = null;
	let rateDirection: "UP" | "DOWN" | "SAME" | null = null;
	if (data.prevCompletionRate !== null) {
		rateChange = data.completionRate - data.prevCompletionRate;
		rateDirection = rateChange > 0 ? "UP" : rateChange < 0 ? "DOWN" : "SAME";
	}

	// 카테고리 분석
	const activeCats = data.categoryBreakdown.filter((c) => c.total > 0);
	const bestCategory =
		activeCats.length > 0
			? activeCats.reduce((a, b) => (b.rate > a.rate ? b : a))
			: null;
	const worstCategory =
		activeCats.length > 1
			? activeCats.reduce((a, b) => (b.rate < a.rate ? b : a))
			: null;

	// 요일 분석
	const activeDayPatterns = data.dayPatterns.filter((d) => d.total > 0);
	const bestDay =
		activeDayPatterns.length > 0
			? activeDayPatterns.reduce((a, b) => (b.rate > a.rate ? b : a))
			: null;
	const worstDay =
		activeDayPatterns.length > 1
			? activeDayPatterns.reduce((a, b) => (b.rate < a.rate ? b : a))
			: null;

	const activeDays = activeDayPatterns.length;
	const perfectDays = activeDayPatterns.filter((d) => d.rate === 100).length;
	const avgDailyTodos =
		activeDays > 0 ? Math.round(data.totalTodos / activeDays) : 0;

	// 주중 vs 주말
	const weekdayDays = activeDayPatterns.filter((d) => WEEKDAYS.has(d.day));
	const weekendDays = activeDayPatterns.filter((d) => !WEEKDAYS.has(d.day));

	const computeAvgRate = (
		days: { total: number; completed: number }[],
	): number => {
		const totalAll = days.reduce((s, d) => s + d.total, 0);
		const compAll = days.reduce((s, d) => s + d.completed, 0);
		return totalAll > 0 ? Math.round((compAll / totalAll) * 100) : 0;
	};

	const weekdayRate = computeAvgRate(weekdayDays);
	const weekendRate = computeAvgRate(weekendDays);

	// 시간대 분석
	const sortedTime = [...data.timePatterns].sort((a, b) => b.count - a.count);
	const peakHour = sortedTime[0] ?? null;
	const topTimeSlots = sortedTime.slice(0, 3);

	let peakPeriod = "없음";
	if (peakHour) {
		const h = peakHour.hour;
		if (h >= 6 && h < 12) peakPeriod = "오전";
		else if (h >= 12 && h < 18) peakPeriod = "오후";
		else if (h >= 18 && h < 23) peakPeriod = "저녁";
		else peakPeriod = "새벽/밤";
	}

	return {
		rateChange,
		rateDirection,
		bestCategory: bestCategory
			? { name: bestCategory.name, rate: bestCategory.rate }
			: null,
		worstCategory: worstCategory
			? { name: worstCategory.name, rate: worstCategory.rate }
			: null,
		bestDay: bestDay
			? { day: DAY_KOREAN[bestDay.day] ?? bestDay.day, rate: bestDay.rate }
			: null,
		worstDay: worstDay
			? { day: DAY_KOREAN[worstDay.day] ?? worstDay.day, rate: worstDay.rate }
			: null,
		avgDailyTodos,
		perfectDays,
		activeDays,
		weekdayRate,
		weekendRate,
		peakHour,
		peakPeriod,
		topTimeSlots,
	};
}

// ============================================================================
// 공통 헬퍼
// ============================================================================

function formatRateChange(insights: DerivedInsights): string {
	if (insights.rateChange === null) return "비교 데이터 없음 (첫 리포트)";
	const sign = insights.rateChange > 0 ? "+" : "";
	const arrow =
		insights.rateDirection === "UP"
			? "↑ 상승"
			: insights.rateDirection === "DOWN"
				? "↓ 하락"
				: "동일";
	return `${sign}${insights.rateChange}%p ${arrow}`;
}

function buildCategoryLines(data: AggregatedReportData): string {
	if (data.categoryBreakdown.length === 0) return "  (카테고리 없음)";
	return data.categoryBreakdown
		.map((c) => `  - ${c.name}: ${c.completed}/${c.total} (${c.rate}%)`)
		.join("\n");
}

function buildTimeLines(insights: DerivedInsights): string {
	if (insights.topTimeSlots.length === 0) return "  (시간대 데이터 없음)";
	return insights.topTimeSlots
		.map((t, i) => `  ${i + 1}. ${t.hour}시 (${t.count}개 완료)`)
		.join("\n");
}

const SYSTEM_PERSONA = `너는 "아이도냥", 사용자 전담 생산성 코치 고양이야.
말투: 친근한 반말 + 문장 끝에 "~냥"을 자연스럽게 섞어줘. 매 문장마다 붙이지 말고 2-3문장에 한 번 정도.
역할: 숫자를 읽어주는 게 아니라, 숫자 뒤에 숨은 행동 패턴을 찾아주는 코치야.`;

// ============================================================================
// 주간 프롬프트
// ============================================================================

function buildWeeklyNoActivityPrompt(periodLabel: string): string {
	return `${SYSTEM_PERSONA}

이번 ${periodLabel}에는 등록된 할 일이 없었어.

- summary: 쉬어가는 주도 있는 거라고 가볍게 공감하고, 다음 주에 딱 1개만 등록해보자고 격려 (2-3문장)
- tips: 지금 당장 할 수 있는 초간단 할 일 예시 1-2개 (예: "내일 아침 물 한 잔 마시기")

JSON으로 응답해.`;
}

function buildWeeklyActivityPrompt(
	data: AggregatedReportData,
	periodLabel: string,
): string {
	const insights = computeDerivedInsights(data);
	const categoryLines = buildCategoryLines(data);
	const timeLines = buildTimeLines(insights);

	return `${SYSTEM_PERSONA}

사용자의 ${periodLabel} 데이터야. 이걸 보고 코칭해줘.

## 데이터
- 달성률: ${data.completionRate}% (${data.completedTodos}/${data.totalTodos})
- 지난주 대비: ${formatRateChange(insights)}
- 연속 달성일: ${data.streakDays}일
- 100% 달성 요일: ${insights.perfectDays}일 / ${insights.activeDays}일 활동일
- 하루 평균: ${insights.avgDailyTodos}개
- 주중: ${insights.weekdayRate}% | 주말: ${insights.weekendRate}%

## 카테고리
${categoryLines}

## 요일
- 최고: ${insights.bestDay ? `${insights.bestDay.day} (${insights.bestDay.rate}%)` : "없음"}
- 최저: ${insights.worstDay ? `${insights.worstDay.day} (${insights.worstDay.rate}%)` : "없음"}

## 시간대
${timeLines}

## ★ summary 작성법 (반드시 이 순서로)
1문장: 행동 유형 진단 — 데이터에서 보이는 사용자의 유형을 한마디로 정의해
  예) "넌 월요일에 엔진 거는 로켓 스타터형이야"
  예) "넌 주말에 몰아서 하는 벼락치기형이네"
  예) "오전에 집중 폭발하는 모닝형이야"
2문장: 숨은 패턴 — 차트만 봐서는 모를, 데이터를 교차 분석해서 발견한 인사이트
  예) 주중/주말 격차, 특정 요일+카테고리 조합, 시간대별 카테고리 편중 등
3문장: 지난주 대비 변화가 있으면 왜 올랐는지/내렸는지 요일·카테고리로 추론
4문장: 격려 또는 개선 포인트 (80%+→칭찬, 50%-→공감, 그 사이→균형)

금지: "달성률이 XX%야", "XX개 중 XX개를 완료했어" 같은 숫자 읽기. 유저는 차트로 이미 알고 있어.

## ★ tips 작성법
각 팁 = [구체적 행동] + [언제/어디서] + [왜(데이터 근거)]
- "다음 주 ${insights.worstDay?.day ?? "약한 요일"}에는 할 일을 2개 이하로만 넣어봐. 이번 주 데이터 보면 그날 과부하가 원인이야"
- "중요한 일은 ${insights.peakHour ? `${insights.peakHour.hour}시` : "집중 시간"}에 넣어봐. 네 골든타임이야"
이런 수준으로 구체적이어야 함.
절대 금지: "큰 일을 나눠봐", "루틴을 만들어봐", "꾸준히 해봐" 같은 누구에게나 해당되는 조언

JSON으로 응답해.`;
}

// ============================================================================
// 월간 프롬프트
// ============================================================================

function buildMonthlyNoActivityPrompt(periodLabel: string): string {
	return `${SYSTEM_PERSONA}

이번 ${periodLabel}, 한 달 동안 등록된 할 일이 없었어.

- summary: 한 달 쉰 것도 괜찮다고 공감하되, 다음 달에는 하루 1개씩만 시작해보자고 진심으로 격려 (2-3문장)
- tips: 다음 달 첫 주에 바로 시작할 수 있는 구체적인 할 일 예시 1-2개

JSON으로 응답해.`;
}

function buildMonthlyActivityPrompt(
	data: AggregatedReportData,
	periodLabel: string,
): string {
	const insights = computeDerivedInsights(data);
	const categoryLines = buildCategoryLines(data);
	const timeLines = buildTimeLines(insights);

	const perfectRatio =
		insights.activeDays > 0
			? Math.round((insights.perfectDays / insights.activeDays) * 100)
			: 0;

	return `${SYSTEM_PERSONA}

사용자의 ${periodLabel} 한 달 데이터야. 월간 코칭해줘.

## 데이터
- 달성률: ${data.completionRate}% (${data.completedTodos}/${data.totalTodos})
- 지난달 대비: ${formatRateChange(insights)}
- 하루 평균: ${insights.avgDailyTodos}개
- 연속 달성일: ${data.streakDays}일
- 완벽한 날 비율: ${perfectRatio}% (${insights.perfectDays}/${insights.activeDays}일)
- 주중: ${insights.weekdayRate}% | 주말: ${insights.weekendRate}%

## 카테고리
${categoryLines}

## 요일
- 강점: ${insights.bestDay ? `${insights.bestDay.day} (${insights.bestDay.rate}%)` : "없음"}
- 약점: ${insights.worstDay ? `${insights.worstDay.day} (${insights.worstDay.rate}%)` : "없음"}

## 시간대
${timeLines}

## ★ summary 작성법 (반드시 이 순서로)
1문장: 한 달 성장 진단 — 이 사람의 한 달을 한마디로 정의해
  예) "업무 쪽은 확실히 습관이 자리 잡았는데, 자기계발은 아직 시동 거는 중이야"
  예) "지난달보다 확실히 성장했어. 특히 주중 루틴이 단단해졌어"
2문장: 습관 정착 평가 — 완벽한 날 비율(${perfectRatio}%)과 연속 달성일(${data.streakDays}일)로 판단
  예) 완벽한 날 비율 높으면 → "습관이 몸에 배기 시작했어"
  예) 낮으면 → "아직 습관이 고정되진 않았지만, 시도 자체가 의미 있어"
3문장: 카테고리 밸런스 — 한 분야에만 치우쳤는지, 고르게 했는지 평가
4문장: 지난달 대비 변화 원인 추론 + 다음 달 기대

금지: "달성률이 XX%야", "XX개를 완료했어" 같은 숫자 읽기. 차트에 이미 있어.

## ★ tips 작성법
주간 팁보다 큰 그림의 전략이어야 함.
각 팁 = [다음 달 전략] + [구체적 수치/요일] + [왜(데이터 근거)]
- "다음 달에는 하루 할 일을 ${insights.avgDailyTodos}개에서 ${Math.max(1, insights.avgDailyTodos - 1)}개로 줄여봐. 완벽한 날 비율이 ${perfectRatio}%인 건 목표 과부하 신호야"
- "${insights.worstCategory?.name ?? "약한 카테고리"}는 ${insights.bestDay?.day ?? "강점 요일"}에 몰아서 넣어봐. 그날이 네 엔진이 가장 잘 도는 날이야"
이런 수준. 절대 금지: "꾸준히 해봐", "작은 목표부터", "루틴을 만들어봐"

JSON으로 응답해.`;
}

// ============================================================================
// 공개 API
// ============================================================================

/**
 * AI 리포트 프롬프트 생성
 *
 * type에 따라 주간/월간 전용 프롬프트를 생성합니다.
 */
export function buildReportPrompt(
	data: AggregatedReportData,
	periodLabel: string,
	type: ReportType,
): string {
	if (!data.hasActivity) {
		return type === "WEEKLY"
			? buildWeeklyNoActivityPrompt(periodLabel)
			: buildMonthlyNoActivityPrompt(periodLabel);
	}
	return type === "WEEKLY"
		? buildWeeklyActivityPrompt(data, periodLabel)
		: buildMonthlyActivityPrompt(data, periodLabel);
}
