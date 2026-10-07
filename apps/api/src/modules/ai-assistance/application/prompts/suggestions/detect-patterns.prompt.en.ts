import { AI_SUGGESTION_LIMITS } from "@aido/api/vocabulary";

import {
  PROMPT_OUTPUT_DISCIPLINE_EN,
  PROMPT_SECURITY_GUARD_EN,
} from "#api/shared/domain/prompt/prompt-sections";
import { encodeUntrustedJson } from "#api/shared/domain/prompt/sanitize";

import { collectRecordedActivities } from "../../../domain/services/suggestions/recorded-activity-evidence.js";
import type { SuggestionContext } from "../../types/suggestions/suggestion-context.js";
import type { SuggestionPrompt } from "./detect-patterns.prompt.types.js";

function buildPatternRulesEn(minOccurrences: number): string {
  return `<rules>
- Return only strongly grounded suggestions, 0-5 total. If evidence is weak, do not invent filler.
- title becomes a to-do immediately after acceptance. Keep the original recorded activity title and any stated amount. "Running" stays "Running"; "Running for 30 minutes" stays unchanged. Add no unstated time, count, or distance.
- Repetition normally needs the same title ${minOccurrences}+ times. Two repeats require confidence >= 0.75.
- Choose an actual original title for repetition too. Do not decrease or increase amounts, or calculate a new amount even when different amounts appear in real records.
- matchedTitles must exactly copy every actual occurrence in context.todos supporting the activity. Three records with the same title require three copies, not one deduplicated string. Use an empty array without direct title evidence.
- When recordedActivities is present, use its server-calculated days from actual startDate as the primary weekday evidence. total counts registered records; completed counts completed records. Never change MON to SUN or registered to completed. Select repetition daysOfWeek only from that activity's actual days.
- Never repeat a matched title more often than it appears in the actual records. Do not invent habits, durations, days, or clock times as the user's past behavior.
- scheduledTime is null without actual clock-time evidence for this activity. Suggest doing the same activity again on a recorded weekday, without creating an unstated time, amount, or new habit.
- reason is 1-2 sentences: distinguish actual registered/completed counts and recorded weekdays, then explain how a repeat setting on those days can reduce entering the activity again. Never invent periods such as "N weeks straight", emotions, consistency, or established habits.
- Never make weather suggestions when weather is null. Do not resuggest a dismissed activity by changing only duration, amount, or wording. Dismissing 10 minutes of reading also excludes a 15-minute reading proposal.
- Keep types diverse. Suggestions with empty matchedTitles are capped at 2 in total.
</rules>`;
}

const STARTER_RULES_EN = `<rules>
- This is a starter stage with 1-2 recent records. Return at most 2 options to retry actual activities on recorded weekdays; do not duplicate the same activity.
- Keep the original activity title and stated amount. Do not turn "Running" into 30 minutes or change "Running for 30 minutes" to 10 minutes. Add no unstated time, count, or distance.
- Evidence is insufficient to claim repetition, consistency, or a long-term habit. matchedTitles must be empty and confidence must be <= 0.60.
- Select daysOfWeek from actual recorded weekdays. scheduledTime is null without this activity's actual clock time. Do not create places or routine cues such as morning or coffee.
- Never mention weather when weather is null. Do not resuggest accepted or dismissed activities by changing amounts or wording.
</rules>`;

export function buildSuggestionPromptEn(
  context: SuggestionContext,
  minOccurrences: number,
): SuggestionPrompt {
  const isStarter =
    context.todos.length > 0 && context.todos.length < AI_SUGGESTION_LIMITS.MIN_OCCURRENCES;
  const mode = isStarter ? "STARTER" : "PATTERN";
  const system = `<role>
You are a coach who analyzes the user's to-do data and suggests actionable routines.
</role>

${PROMPT_SECURITY_GUARD_EN}

${isStarter ? STARTER_RULES_EN : buildPatternRulesEn(minOccurrences)}

<quality_check>
- ACCEPTED in suggestionHistory means the activity was already accepted. Do not recommend it again, even with changed amounts or wording.
- Are activity titles and amounts unchanged from actual records, with no unstated time, count, or distance?
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
      recordedActivities: context.recordedActivities ?? collectRecordedActivities(context.todos),
    })}\n</context_json>\n<task>Analyze the user data and suggest personalized routines. Write title and reason in English. Check grounding internally, then return only the structured result.</task>`,
  };
}
