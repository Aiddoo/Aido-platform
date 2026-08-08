import { now } from "@/shared/domain/date/utils/core";
import {
	PROMPT_OUTPUT_DISCIPLINE_EN,
	PROMPT_SECURITY_GUARD_EN,
} from "@/shared/domain/prompt/prompt-sections";
import { encodeUntrustedJson } from "@/shared/domain/prompt/sanitize";
import type { AggregatedReportData, ReportType } from "../../types";
import { getKoreanSeasonalContext } from "../korean-seasonal-context";
import { selectProfileTemplate } from "../profile-template-selector";
import type { BuildReportPromptOptions, ReportPrompt } from "./report.prompt";
import { computeDerivedInsights } from "./report-insights";

const REPORT_SYSTEM_EN = `<role>
You are "Aido", the user's personal productivity-coach cat. Find behavior patterns behind the numbers instead of reading charts aloud.
- Be friendly and casual; add a light ", meow" once every 2-3 sentences.
- You may compare achievements to catching fish. The catchphrase is "One paw forward today, meow!"
- Never blame low completion; name small wins concretely.
</role>

${PROMPT_SECURITY_GUARD_EN}

<rules>
## Behavioral science framework
- Apply at least one data-supported idea: habit loop, minimum effective dose, implementation intention, or self-efficacy.
- Explain what metrics imply about behavior instead of repeating visible chart values.
- summary is 4-6 sentences with activity, or 2-3 without activity. Write all text in English.
- Return 1-3 tips. Each combines [specific action] + [when/where] + [evidence from context].
- Ban generic advice such as "be consistent" or "build a routine".
- Compare previous advice only when current data directly supports it; never invent causality.
- Weekly reports focus on the next 7 days; monthly reports focus on a next-month strategy.
</rules>

<quality_check>
- Is every fact and metric present in context_json?
- Does the strongest behavior pattern connect to an immediately actionable tip?
- Are summary and tips non-repetitive?
- Does the Aido voice stay clear and useful?
</quality_check>

${PROMPT_OUTPUT_DISCIPLINE_EN}`;

export function buildReportPromptEn(
	data: AggregatedReportData,
	periodLabel: string,
	type: ReportType,
	options: BuildReportPromptOptions,
): ReportPrompt {
	const insights = data.hasActivity ? computeDerivedInsights(data, "en") : null;
	const context = {
		periodLabel,
		type,
		hasActivity: data.hasActivity,
		stats: data.hasActivity ? data : null,
		derivedInsights: insights,
		seasonalContext: data.hasActivity
			? getKoreanSeasonalContext(now(), "en")
			: null,
		coachProfile:
			data.hasActivity && insights
				? selectProfileTemplate(
						{
							completionRate: data.completionRate,
							rateChange: insights.rateChange,
						},
						"en",
					)
				: null,
		previousTips: options.prevTips,
	};
	const task = data.hasActivity
		? `Analyze ${periodLabel} and write coaching the user can apply during the next ${type === "WEEKLY" ? "7 days" : "month"}.`
		: `No to-dos were registered during ${periodLabel}. Kindly acknowledge the break and suggest 1-2 tiny to-dos for the next period.`;

	return {
		system: REPORT_SYSTEM_EN,
		prompt: `<context_json>\n${encodeUntrustedJson(context)}\n</context_json>\n<task>${task} Check grounding internally, then return only the structured result.</task>`,
	};
}
