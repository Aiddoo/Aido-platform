import {
	PROMPT_OUTPUT_DISCIPLINE_EN,
	PROMPT_SECURITY_GUARD_EN,
} from "@/shared/domain/prompt/prompt-sections";
import { encodeUntrustedJson } from "@/shared/domain/prompt/sanitize";
import type { SuggestionContext } from "../../types";
import type { SuggestionPrompt } from "./detect-patterns.prompt";

function buildPatternRulesEn(minOccurrences: number): string {
	return `<rules>
- Return only strongly grounded suggestions, 0-5 total. If evidence is weak, do not invent filler.
- title becomes a to-do immediately after acceptance. Use a concrete action and amount, such as "Morning stretch 10 min". Ban abstract titles such as "focus time" or "workout plan".
- Repetition normally needs the same title ${minOccurrences}+ times. Two repeats require confidence >= 0.75.
- Level-up suggestions require at least 2 real titles with different measurable levels.
- matchedTitles must exactly copy titles from context.todos. Use an empty array for suggestions without direct title evidence.
- reason is 1-2 sentences and uses a numeric fact actually present in context. Never invent durations such as "N weeks straight".
- Never make weather suggestions when weather is null. Avoid suggestions similar to dismissed history.
- Keep types diverse. Suggestions with empty matchedTitles are capped at 2 in total.
</rules>`;
}

const STARTER_RULES_EN = `<rules>
- This is a starter stage with only 1-2 recent records. Return 1-2 lightweight suggestions that help the user build useful history.
- Do not call it a detected pattern. Never claim repetition, consistency, or "N weeks straight".
- Use the record's context for a concrete, low-friction action, such as 5-20 minutes or a small count.
- matchedTitles must be empty and confidence must be <= 0.60.
- Use only 1-2 actionable days. scheduledTime is null unless context contains time evidence.
- Never mention weather when weather is null. Avoid suggestions similar to dismissed history.
</rules>`;

export function buildSuggestionPromptEn(
	context: SuggestionContext,
	minOccurrences: number,
): SuggestionPrompt {
	const isStarter =
		context.todos.length > 0 && context.todos.length < minOccurrences;
	const mode = isStarter ? "STARTER" : "PATTERN";
	const system = `<role>
You are a coach who analyzes the user's to-do data and suggests actionable routines.
</role>

${PROMPT_SECURITY_GUARD_EN}

${isStarter ? STARTER_RULES_EN : buildPatternRulesEn(minOccurrences)}

<quality_check>
- Is every title, metric, day, and time grounded in context_json?
- Is the next action obvious immediately after acceptance?
- Did you avoid overstating a pattern when data is sparse?
- Did you remove duplicates and filler?
</quality_check>

${PROMPT_OUTPUT_DISCIPLINE_EN}`;

	return {
		system,
		prompt: `<context_json>\n${encodeUntrustedJson({
			mode,
			todoCount: context.todos.length,
			...context,
		})}\n</context_json>\n<task>Analyze the user data and suggest personalized routines. Write title and reason in English. Check grounding internally, then return only the structured result.</task>`,
	};
}
