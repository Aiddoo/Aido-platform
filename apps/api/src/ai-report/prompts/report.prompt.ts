import { z } from "zod";
import type { ReportType } from "@/generated/prisma/client";
import { now } from "@/shared/domain/date/utils/core";
import type { SupportedLocale } from "@/shared/presentation/decorators";
import { PROMPT_OUTPUT_DISCIPLINE } from "../../ai/shared/prompt-sections";
import type { AggregatedReportData } from "../types";
import { getKoreanSeasonalContext } from "../utils/korean-seasonal-context";
import { selectProfileTemplate } from "../utils/profile-template-selector";
import { buildReportPromptEn } from "./report.prompt.en";
import {
	computeDerivedInsights,
	type DerivedInsights,
} from "./report-insights";

/**
 * AI 리포트 생성 응답 스키마
 */
export const reportAiResponseSchema = z.object({
	summary: z.string().describe("한국어로 작성된 주간/월간 요약 (4-6문장)"),
	tips: z
		.array(z.string())
		.min(1)
		.max(3)
		.describe("실천 가능한 팁 1-3개 (한국어)"),
});

export type ReportAiResponse = z.infer<typeof reportAiResponseSchema>;

/**
 * en 로케일용 응답 스키마 — describe만 영어 (스키마 구조 동일)
 */
export const reportAiResponseSchemaEn = z.object({
	summary: z
		.string()
		.describe("Weekly/monthly summary written in English (4-6 sentences)"),
	tips: z
		.array(z.string())
		.min(1)
		.max(3)
		.describe("1-3 actionable tips (English)"),
});

export function getReportAiResponseSchema(locale: SupportedLocale) {
	return locale === "en" ? reportAiResponseSchemaEn : reportAiResponseSchema;
}

/**
 * 프롬프트 빌드 옵션
 */
export interface BuildReportPromptOptions {
	prevTips: string[] | null;
}

// ============================================================================
// 파생 인사이트 계산
// ============================================================================

// ============================================================================
// 공통 헬퍼
// ============================================================================

function formatRateChange(insights: DerivedInsights): string {
	if (insights.rateChange === null) {
		return "비교 데이터 없음 (첫 리포트)";
	}
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
	if (data.categoryBreakdown.length === 0) {
		return "  (카테고리 없음)";
	}
	return data.categoryBreakdown
		.map((c) => `  - ${c.name}: ${c.completed}/${c.total} (${c.rate}%)`)
		.join("\n");
}

function buildTimeLines(insights: DerivedInsights): string {
	if (insights.topTimeSlots.length === 0) {
		return "  (시간대 데이터 없음)";
	}
	return insights.topTimeSlots
		.map((t, i) => `  ${i + 1}. ${t.hour}시 (${t.count}개 완료)`)
		.join("\n");
}

function buildPrevTipsSection(prevTips: string[] | null): string {
	if (!prevTips || prevTips.length === 0) {
		return "";
	}

	const lines = prevTips.map((tip, i) => `${i + 1}. ${tip}`);
	return [
		"",
		"## 지난주에 내가 한 조언",
		...lines,
		"→ 이번 주 데이터에서 이 조언이 효과가 있었는지 반드시 추적해서 언급해줘.",
		"",
	].join("\n");
}

const SYSTEM_PERSONA = `너는 "아이도냥", 사용자 전담 생산성 코치 고양이야.

성격:
- 친근한 반말 + "~냥"을 자연스럽게 2-3문장에 한 번 섞어줘
- 성취를 물고기에 비유하길 좋아해 (예: "이번 주 큰 물고기 잡았다!", "작은 멸치라도 매일 잡는 게 중요해")
- 캐치프레이즈: "오늘도 한 발자국 앞으로 냥!"

톤 분기:
- 달성률 80%+: 장난스럽고 자랑스러운 톤, 농담 섞어도 OK
- 달성률 50-80%: 따뜻하고 분석적인 톤, 구체적 개선 포인트 제시
- 달성률 50% 미만: 다정하고 공감하는 톤, 작은 성공 크게 강조, 절대 비난하지 않기

역할: 숫자를 읽어주는 게 아니라, 숫자 뒤에 숨은 행동 패턴을 찾아주는 코치야.
금지: "달성률이 XX%야", "XX개 중 XX개를 완료했어" 같은 숫자 읽기. 유저는 차트로 이미 알고 있어.`;

const BEHAVIORAL_SCIENCE_FRAMEWORK = `## 행동과학 프레임워크 (반드시 1개 이상 적용)
- 습관 루프 (신호→루틴→보상): 시간대 패턴에서 신호를 찾아줘
- 최소 유효 용량: 완벽한 날 비율이 낮으면 할 일 수를 줄이라고 제안
- 구현 의도: "언제, 어디서, 무엇을" 형식으로 팁을 구체화
- 자기효능감: 작은 성공을 크게 강조해서 동기부여`;

const TIPS_RULES = `## ★ tips 작성법
각 팁 = [구체적 행동] + [언제/어디서] + [왜(데이터 근거)]
- 구현 의도 형식: "X요일 Y시에 Z를 해봐. 네 데이터 보면 ~이기 때문이야"
- 행동과학 근거를 자연스럽게 포함
절대 금지: "큰 일을 나눠봐", "루틴을 만들어봐", "꾸준히 해봐" 같은 누구에게나 해당되는 조언`;

// ============================================================================
// 주간 프롬프트
// ============================================================================

function buildWeeklyNoActivityPrompt(periodLabel: string): string {
	return `${SYSTEM_PERSONA}

이번 ${periodLabel}에는 등록된 할 일이 없었어.

- summary: 쉬어가는 주도 있는 거라고 가볍게 공감하고, 다음 주에 딱 1개만 등록해보자고 격려 (2-3문장)
- tips: 지금 당장 할 수 있는 초간단 할 일 예시 1-2개 (예: "내일 아침 물 한 잔 마시기")

${PROMPT_OUTPUT_DISCIPLINE}

JSON으로 응답해.`;
}

function buildWeeklyActivityPrompt(
	data: AggregatedReportData,
	periodLabel: string,
	options: BuildReportPromptOptions,
): string {
	const insights = computeDerivedInsights(data);
	const categoryLines = buildCategoryLines(data);
	const timeLines = buildTimeLines(insights);
	const seasonalContext = getKoreanSeasonalContext(now());
	const profileTemplate = selectProfileTemplate({
		completionRate: data.completionRate,
		rateChange: insights.rateChange,
	});
	const prevTipsSection = buildPrevTipsSection(options.prevTips);

	return `${SYSTEM_PERSONA}
${prevTipsSection}
${seasonalContext ? `\n${seasonalContext}\n` : ""}
${BEHAVIORAL_SCIENCE_FRAMEWORK}

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

${profileTemplate}

${TIPS_RULES}

${PROMPT_OUTPUT_DISCIPLINE}

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

${PROMPT_OUTPUT_DISCIPLINE}

JSON으로 응답해.`;
}

function buildMonthlyActivityPrompt(
	data: AggregatedReportData,
	periodLabel: string,
	options: BuildReportPromptOptions,
): string {
	const insights = computeDerivedInsights(data);
	const categoryLines = buildCategoryLines(data);
	const timeLines = buildTimeLines(insights);
	const seasonalContext = getKoreanSeasonalContext(now());
	const profileTemplate = selectProfileTemplate({
		completionRate: data.completionRate,
		rateChange: insights.rateChange,
	});
	const prevTipsSection = buildPrevTipsSection(options.prevTips);

	const perfectRatio =
		insights.activeDays > 0
			? Math.round((insights.perfectDays / insights.activeDays) * 100)
			: 0;

	return `${SYSTEM_PERSONA}
${prevTipsSection}
${seasonalContext ? `\n${seasonalContext}\n` : ""}
${BEHAVIORAL_SCIENCE_FRAMEWORK}

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

${profileTemplate}

## ★ tips 작성법
주간 팁보다 큰 그림의 전략이어야 함.
각 팁 = [다음 달 전략] + [구체적 수치/요일] + [왜(데이터 근거)]
- 행동과학 근거를 자연스럽게 포함
절대 금지: "꾸준히 해봐", "작은 목표부터", "루틴을 만들어봐"

${PROMPT_OUTPUT_DISCIPLINE}

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
	options: BuildReportPromptOptions,
	locale: SupportedLocale = "ko",
): string {
	if (locale === "en") {
		return buildReportPromptEn(data, periodLabel, type, options);
	}
	if (type === "WEEKLY") {
		return data.hasActivity
			? buildWeeklyActivityPrompt(data, periodLabel, options)
			: buildWeeklyNoActivityPrompt(periodLabel);
	}
	return data.hasActivity
		? buildMonthlyActivityPrompt(data, periodLabel, options)
		: buildMonthlyNoActivityPrompt(periodLabel);
}
