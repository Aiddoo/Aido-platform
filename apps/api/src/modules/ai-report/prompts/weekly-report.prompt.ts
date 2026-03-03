import { z } from "zod";
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

/**
 * 요일 한국어 매핑
 */
const DAY_KOREAN: Record<string, string> = {
	MON: "월요일",
	TUE: "화요일",
	WED: "수요일",
	THU: "목요일",
	FRI: "금요일",
	SAT: "토요일",
	SUN: "일요일",
};

/**
 * 활동이 없는 기간의 프롬프트 생성
 */
function buildNoActivityPrompt(periodLabel: string): string {
	return `너는 "아이도냥"이라는 이름의 고양이 캐릭터야. 짧고 친근한 반말로 말해.

이번 ${periodLabel}에는 등록된 할 일이 없었어.

다음 JSON 형식으로 응답해:
- summary: 활동이 없었음을 알려주되, 다음에는 할 일을 등록해보라고 가볍게 격려하는 내용 (2-3문장, 한국어)
- tips: 할 일 관리를 시작할 수 있는 실천 가능한 팁 1-2개 (한국어)`;
}

/**
 * 활동이 있는 기간의 프롬프트 생성
 */
function buildActivityPrompt(
	data: AggregatedReportData,
	periodLabel: string,
): string {
	const bestDay = [...data.dayPatterns].sort((a, b) => b.rate - a.rate)[0];
	const worstDay = [...data.dayPatterns]
		.filter((d) => d.total > 0)
		.sort((a, b) => a.rate - b.rate)[0];

	const peakHour = [...data.timePatterns].sort((a, b) => b.count - a.count)[0];

	const categoryLines = data.categoryBreakdown
		.map((c) => `  - ${c.name}: ${c.completed}/${c.total} (${c.rate}%)`)
		.join("\n");

	const prevRateInfo =
		data.prevCompletionRate !== null
			? `지난 기간 달성률: ${data.prevCompletionRate}%`
			: "이전 기간 데이터 없음";

	return `너는 "아이도냥"이라는 이름의 고양이 캐릭터야. 짧고 친근한 반말로 말해.
사용자의 ${periodLabel} 할 일 데이터를 분석해서 요약과 팁을 만들어줘.

## 통계
- 전체 할 일: ${data.totalTodos}개
- 완료: ${data.completedTodos}개
- 달성률: ${data.completionRate}%
- ${prevRateInfo}
- 연속 달성일: ${data.streakDays}일

## 카테고리별
${categoryLines}

## 요일별 최고/최저
- 최고: ${bestDay ? `${DAY_KOREAN[bestDay.day] ?? bestDay.day} (${bestDay.rate}%)` : "없음"}
- 최저: ${worstDay ? `${DAY_KOREAN[worstDay.day] ?? worstDay.day} (${worstDay.rate}%)` : "없음"}

## 시간대
- 가장 많이 완료한 시간: ${peakHour ? `${peakHour.hour}시 (${peakHour.count}개)` : "없음"}

다음 JSON 형식으로 응답해:
- summary: 데이터 기반 분석 요약 (3-5문장, 한국어, 격려 또는 개선 포인트 포함)
- tips: 실천 가능한 팁 1-3개 (한국어, 구체적으로)`;
}

/**
 * AI 리포트 프롬프트 생성
 */
export function buildReportPrompt(
	data: AggregatedReportData,
	periodLabel: string,
): string {
	if (!data.hasActivity) {
		return buildNoActivityPrompt(periodLabel);
	}
	return buildActivityPrompt(data, periodLabel);
}
