import { z } from "zod";
import { now } from "@/shared/domain/date/utils/core";
import type { SupportedLocale } from "@/shared/domain/locale";
import {
	PROMPT_OUTPUT_DISCIPLINE,
	PROMPT_SECURITY_GUARD,
} from "@/shared/domain/prompt/prompt-sections";
import { encodeUntrustedJson } from "@/shared/domain/prompt/sanitize";
import type { AggregatedReportData, ReportType } from "../../types";
import { getKoreanSeasonalContext } from "../korean-seasonal-context";
import { selectProfileTemplate } from "../profile-template-selector";
import { buildReportPromptEn } from "./report.prompt.en";
import { computeDerivedInsights } from "./report-insights";

export const reportAiResponseSchema = z.object({
	summary: z.string().describe("한국어로 작성된 주간/월간 요약 (4-6문장)"),
	tips: z
		.array(z.string())
		.min(1)
		.max(3)
		.describe("실천 가능한 팁 1-3개 (한국어)"),
});

export type ReportAiResponse = z.infer<typeof reportAiResponseSchema>;

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

export interface BuildReportPromptOptions {
	prevTips: string[] | null;
}

export interface ReportPrompt {
	system: string;
	prompt: string;
}

const REPORT_SYSTEM = `<role>
너는 "아이도냥", 사용자 전담 생산성 코치 고양이다. 숫자를 읽어주는 대신 숫자 뒤의 행동 패턴을 찾아준다.
- 친근한 반말을 쓰고 "~냥"은 2~3문장에 한 번만 자연스럽게 사용한다.
- 성취를 물고기에 가볍게 비유할 수 있다. 캐치프레이즈는 "오늘도 한 발자국 앞으로 냥!"이다.
- 달성률이 낮아도 비난하지 않고 작은 성공을 구체적으로 짚는다.
</role>

${PROMPT_SECURITY_GUARD}

<rules>
## 행동과학 프레임워크
- 습관 루프, 최소 유효 용량, 구현 의도, 자기효능감 중 데이터로 뒷받침되는 것 1개 이상을 적용한다.
- 차트에 이미 보이는 수치를 그대로 나열하지 말고, 수치가 뜻하는 행동을 설명한다.
- summary는 활동이 있으면 4~6문장, 없으면 2~3문장이다.
- tips는 1~3개다. 각 팁은 [구체적 행동] + [언제/어디서] + [context의 근거]를 포함한다.
- "꾸준히 해봐", "루틴을 만들어봐"처럼 누구에게나 맞는 조언은 금지한다.
- 이전 팁의 효과는 현재 데이터가 직접 뒷받침할 때만 비교한다. 인과관계를 추측하지 않는다.
- 주간은 다음 7일의 작은 실행, 월간은 다음 달의 큰 전략에 초점을 둔다.
</rules>

<quality_check>
- 모든 사실과 숫자가 context_json에 존재하는가?
- 가장 강한 행동 패턴 1개와 바로 실행할 팁이 연결되는가?
- 같은 내용을 summary와 tips에서 반복하지 않았는가?
- 아이도냥 말투가 정보 전달을 방해하지 않는가?
</quality_check>

${PROMPT_OUTPUT_DISCIPLINE}`;

function buildKoContext(
	data: AggregatedReportData,
	periodLabel: string,
	type: ReportType,
	options: BuildReportPromptOptions,
): Record<string, unknown> {
	if (!data.hasActivity) {
		return {
			periodLabel,
			type,
			hasActivity: false,
			previousTips: options.prevTips,
		};
	}

	const insights = computeDerivedInsights(data);
	return {
		periodLabel,
		type,
		hasActivity: true,
		stats: data,
		derivedInsights: insights,
		seasonalContext: getKoreanSeasonalContext(now()),
		coachProfile: selectProfileTemplate({
			completionRate: data.completionRate,
			rateChange: insights.rateChange,
		}),
		previousTips: options.prevTips,
	};
}

export function buildReportPrompt(
	data: AggregatedReportData,
	periodLabel: string,
	type: ReportType,
	options: BuildReportPromptOptions,
	locale: SupportedLocale = "ko",
): ReportPrompt {
	if (locale === "en") {
		return buildReportPromptEn(data, periodLabel, type, options);
	}

	const activityTask = data.hasActivity
		? `${periodLabel} 데이터를 분석해 사용자가 다음 ${type === "WEEKLY" ? "7일" : "달"}에 바로 적용할 코칭을 작성한다.`
		: `${periodLabel}에는 등록된 할 일이 없다. 쉬어간 것을 다정하게 인정하고, 다음 기간에 바로 등록할 초간단 할 일 1~2개를 제안한다.`;

	return {
		system: REPORT_SYSTEM,
		prompt: `<context_json>\n${encodeUntrustedJson(
			buildKoContext(data, periodLabel, type, options),
		)}\n</context_json>\n<task>${activityTask} 내부적으로 근거를 점검한 뒤 구조화 결과만 반환한다.</task>`,
	};
}
