import type { ReportType } from "@/generated/prisma/client";
import { now } from "@/shared/domain/date/utils/core";
import { PROMPT_OUTPUT_DISCIPLINE_EN } from "@/shared/domain/prompt/prompt-sections";
import type { AggregatedReportData } from "../types";
import { getKoreanSeasonalContext } from "../utils/korean-seasonal-context";
import { selectProfileTemplate } from "../utils/profile-template-selector";
import type { BuildReportPromptOptions } from "./report.prompt";
import {
	computeDerivedInsights,
	type DerivedInsights,
} from "./report-insights";

/**
 * AI 리포트 프롬프트 — 영어 버전 (en 로케일 사용자용).
 * 구조·데이터·행동과학 프레임은 한국어 버전과 동일하며, 지시문만 영어다.
 * 고양이 페르소나(아이도냥)는 브랜드 보이스로 유지한다 (", meow" — 푸시 en 톤과 일치).
 */

function formatRateChangeEn(insights: DerivedInsights): string {
	if (insights.rateChange === null) {
		return "no comparison data (first report)";
	}
	const sign = insights.rateChange > 0 ? "+" : "";
	const arrow =
		insights.rateDirection === "UP"
			? "↑ up"
			: insights.rateDirection === "DOWN"
				? "↓ down"
				: "unchanged";
	return `${sign}${insights.rateChange}%p ${arrow}`;
}

function buildCategoryLinesEn(data: AggregatedReportData): string {
	if (data.categoryBreakdown.length === 0) {
		return "  (no categories)";
	}
	return data.categoryBreakdown
		.map((c) => `  - ${c.name}: ${c.completed}/${c.total} (${c.rate}%)`)
		.join("\n");
}

function buildTimeLinesEn(insights: DerivedInsights): string {
	if (insights.topTimeSlots.length === 0) {
		return "  (no time-slot data)";
	}
	return insights.topTimeSlots
		.map((t, i) => `  ${i + 1}. ${t.hour}:00 (${t.count} completed)`)
		.join("\n");
}

function buildPrevTipsSectionEn(prevTips: string[] | null): string {
	if (!prevTips || prevTips.length === 0) {
		return "";
	}

	const lines = prevTips.map((tip, i) => `${i + 1}. ${tip}`);
	return [
		"",
		"## Advice I gave last time",
		...lines,
		"→ You must check this week's data for whether that advice worked, and mention it.",
		"",
	].join("\n");
}

const SYSTEM_PERSONA_EN = `You are "Aido", the user's personal productivity-coach cat.

Personality:
- Friendly and casual; sprinkle a light ", meow" naturally about once every 2-3 sentences
- Loves comparing achievements to catching fish (e.g. "You landed a big fish this week!", "Even a tiny anchovy a day adds up")
- Catchphrase: "One paw forward today, meow!"

Tone by data:
- Completion rate 80%+: playful and proud, jokes are fine
- 50-80%: warm and analytical, point out concrete improvements
- Below 50%: gentle and empathetic, spotlight small wins, never blame

Role: you don't read numbers back — you find the behavior patterns hiding behind them.
Forbidden: "your completion rate is XX%", "you completed XX out of XX" — the user already sees the charts.`;

const BEHAVIORAL_SCIENCE_FRAMEWORK_EN = `## Behavioral science framework (apply at least 1)
- Habit loop (cue→routine→reward): find the cue in their time-slot patterns
- Minimum effective dose: if their perfect-day ratio is low, suggest fewer to-dos
- Implementation intentions: make tips concrete as "when, where, what"
- Self-efficacy: celebrate small wins loudly to build motivation`;

const TIPS_RULES_EN = `## ★ How to write tips
Each tip = [concrete action] + [when/where] + [why (data evidence)]
- Implementation-intention format: "Try Z at Y o'clock on X-day. Your data shows ~"
- Weave in the behavioral science naturally
Strictly forbidden: generic advice that fits anyone — "break big tasks down", "build a routine", "be consistent"`;

function buildWeeklyNoActivityPromptEn(periodLabel: string): string {
	return `${SYSTEM_PERSONA_EN}

No to-dos were registered for ${periodLabel}.

- summary: gently acknowledge that rest weeks happen, and encourage them to register just 1 to-do next week (2-3 sentences)
- tips: 1-2 super-simple to-dos they could do right now (e.g. "Drink a glass of water tomorrow morning")

${PROMPT_OUTPUT_DISCIPLINE_EN}

Respond in JSON. Write all text in English.`;
}

function buildWeeklyActivityPromptEn(
	data: AggregatedReportData,
	periodLabel: string,
	options: BuildReportPromptOptions,
): string {
	const insights = computeDerivedInsights(data, "en");
	const categoryLines = buildCategoryLinesEn(data);
	const timeLines = buildTimeLinesEn(insights);
	const seasonalContext = getKoreanSeasonalContext(now(), "en");
	const profileTemplate = selectProfileTemplate(
		{
			completionRate: data.completionRate,
			rateChange: insights.rateChange,
		},
		"en",
	);
	const prevTipsSection = buildPrevTipsSectionEn(options.prevTips);

	return `${SYSTEM_PERSONA_EN}
${prevTipsSection}
${seasonalContext ? `\n${seasonalContext}\n` : ""}
${BEHAVIORAL_SCIENCE_FRAMEWORK_EN}

Here is the user's data for ${periodLabel}. Coach them based on it.

## Data
- Completion rate: ${data.completionRate}% (${data.completedTodos}/${data.totalTodos})
- vs last week: ${formatRateChangeEn(insights)}
- Streak: ${data.streakDays} days
- Days at 100%: ${insights.perfectDays} of ${insights.activeDays} active days
- Daily average: ${insights.avgDailyTodos} to-dos
- Weekdays: ${insights.weekdayRate}% | Weekends: ${insights.weekendRate}%

## Categories
${categoryLines}

## Days
- Best: ${insights.bestDay ? `${insights.bestDay.day} (${insights.bestDay.rate}%)` : "none"}
- Worst: ${insights.worstDay ? `${insights.worstDay.day} (${insights.worstDay.rate}%)` : "none"}

## Time slots
${timeLines}

${profileTemplate}

${TIPS_RULES_EN}

${PROMPT_OUTPUT_DISCIPLINE_EN}

Respond in JSON. Write all text in English.`;
}

function buildMonthlyNoActivityPromptEn(periodLabel: string): string {
	return `${SYSTEM_PERSONA_EN}

No to-dos were registered during ${periodLabel}.

- summary: empathize that a month off is okay, then sincerely encourage starting with just 1 to-do a day next month (2-3 sentences)
- tips: 1-2 concrete to-dos they can start in the first week of next month

${PROMPT_OUTPUT_DISCIPLINE_EN}

Respond in JSON. Write all text in English.`;
}

function buildMonthlyActivityPromptEn(
	data: AggregatedReportData,
	periodLabel: string,
	options: BuildReportPromptOptions,
): string {
	const insights = computeDerivedInsights(data, "en");
	const categoryLines = buildCategoryLinesEn(data);
	const timeLines = buildTimeLinesEn(insights);
	const seasonalContext = getKoreanSeasonalContext(now(), "en");
	const profileTemplate = selectProfileTemplate(
		{
			completionRate: data.completionRate,
			rateChange: insights.rateChange,
		},
		"en",
	);
	const prevTipsSection = buildPrevTipsSectionEn(options.prevTips);

	const perfectRatio =
		insights.activeDays > 0
			? Math.round((insights.perfectDays / insights.activeDays) * 100)
			: 0;

	return `${SYSTEM_PERSONA_EN}
${prevTipsSection}
${seasonalContext ? `\n${seasonalContext}\n` : ""}
${BEHAVIORAL_SCIENCE_FRAMEWORK_EN}

Here is the user's data for the month of ${periodLabel}. Give monthly coaching.

## Data
- Completion rate: ${data.completionRate}% (${data.completedTodos}/${data.totalTodos})
- vs last month: ${formatRateChangeEn(insights)}
- Daily average: ${insights.avgDailyTodos} to-dos
- Streak: ${data.streakDays} days
- Perfect-day ratio: ${perfectRatio}% (${insights.perfectDays}/${insights.activeDays} days)
- Weekdays: ${insights.weekdayRate}% | Weekends: ${insights.weekendRate}%

## Categories
${categoryLines}

## Days
- Strength: ${insights.bestDay ? `${insights.bestDay.day} (${insights.bestDay.rate}%)` : "none"}
- Weakness: ${insights.worstDay ? `${insights.worstDay.day} (${insights.worstDay.rate}%)` : "none"}

## Time slots
${timeLines}

${profileTemplate}

## ★ How to write tips
These must be bigger-picture strategies than weekly tips.
Each tip = [next month's strategy] + [specific number/day] + [why (data evidence)]
- Weave in the behavioral science naturally
Strictly forbidden: "be consistent", "start small", "build a routine"

${PROMPT_OUTPUT_DISCIPLINE_EN}

Respond in JSON. Write all text in English.`;
}

/**
 * 영어 리포트 프롬프트 진입점 — buildReportPrompt(locale="en")에서 호출된다.
 */
export function buildReportPromptEn(
	data: AggregatedReportData,
	periodLabel: string,
	type: ReportType,
	options: BuildReportPromptOptions,
): string {
	if (type === "WEEKLY") {
		return data.hasActivity
			? buildWeeklyActivityPromptEn(data, periodLabel, options)
			: buildWeeklyNoActivityPromptEn(periodLabel);
	}
	return data.hasActivity
		? buildMonthlyActivityPromptEn(data, periodLabel, options)
		: buildMonthlyNoActivityPromptEn(periodLabel);
}
