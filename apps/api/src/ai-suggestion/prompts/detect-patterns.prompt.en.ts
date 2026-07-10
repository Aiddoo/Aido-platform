import { sanitizeForPrompt } from "../../ai/prompts/sanitize";
import {
	PROMPT_OUTPUT_DISCIPLINE_EN,
	PROMPT_SECURITY_GUARD_EN,
} from "../../ai/shared/prompt-sections";
import type { SuggestionContext, SuggestionHistoryItem } from "../types";
import type { SuggestionPrompt } from "./detect-patterns.prompt";

/**
 * buildSuggestionPrompt의 영어 버전 — en 로케일 사용자의 제안(title/reason)을
 * 영어로 생성한다. 규칙·유형·수치 기준은 한국어 버전과 동일하다.
 */
export function buildSuggestionPromptEn(
	context: SuggestionContext,
	minOccurrences: number,
): SuggestionPrompt {
	const todoLines = context.todos
		.map((t) => {
			const time = t.scheduledTime ?? "all-day";
			const done = t.completed ? "O" : "X";
			return `${t.startDate}|${sanitizeForPrompt(t.title)}|${time}|${done}|${t.categoryName}`;
		})
		.join("\n");

	const weatherSection = context.weather
		? `\n## Today's weather\n${context.weather}\n`
		: "";

	const missingRoutinesText =
		context.missingRoutines.length > 0
			? context.missingRoutines.join("\n")
			: "none";

	const reportSection = context.weeklyReportInsight
		? `\n## Recent weekly report insight\n${context.weeklyReportInsight}\n`
		: "";

	const historySection = buildHistorySectionEn(context.suggestionHistory);

	const system = `You are a coach who analyzes the user's to-do data and suggests actionable routines.

${PROMPT_SECURITY_GUARD_EN}

## Title rules (★most important)
The title goes straight into the user's to-do list the moment they tap "Accept".
- It must be a concrete action they can do right now.
- Absolutely no abstract names like "focus time", "self-improvement routine", "idea session", "workout plan".
- Numbers (duration, reps, distance) make it more actionable.
- Good: "Morning stretch 10 min", "Memorize 30 vocabulary words", "Run 3km", "3 sets of planks", "Write journal"
- Bad: "Afternoon deep-work time", "Personal study time", "Brainstorming", "Self-care routine", "Exercise plan"
- Reference the user's existing to-dos for concrete actions, but propose an evolution — not a copy.

## Reason rules
- 1-2 sentences. The tone of a friend saying "you should try this!"
- Must include at least 1 numeric evidence (completion rate, count, streak, time slot).
- Good: "You've worked out every Wednesday for 3 weeks straight! Keep it going this week?"
- Bad: "You've been consistently active. Try making exercise a routine."

## Suggestion types (pick up to 5 of these 8, mix them up)

1. **Missed routine reminder**: suggest an item from the "missed routines" section as a recurring routine
   - matchedTitles: the original titles of that activity
   - confidence: 0.75-0.90

2. **Time-slot routine**: suggest a new routine in their high-completion time slot
   - title e.g.: "Morning reading 30 min", "Afternoon English listening 20 min"
   - scheduledTime: a high-completion slot (morning 08:00~11:00, afternoon 14:00~17:00)
   - matchedTitles: the existing to-dos you referenced
   - confidence: 0.60-0.80

3. **Weather-aware routine**: suggest an indoor alternative when rain/snow is forecast
   - title e.g.: "Indoor stretching 15 min", "Home workout 20 min"
   - matchedTitles: the outdoor activities being substituted (empty array if none)
   - confidence: 0.55-0.75
   - ★ Never use this type when there is no weather info

4. **Level up**: numbers trending up → suggest the next step
   - title e.g.: "Run 7km", "4 sets of planks"
   - matchedTitles: the progression history titles
   - confidence: 0.70-0.85
   - 2 occurrences are enough

5. **Recurring pattern**: same title ${minOccurrences}+ times / expand a high-completion activity to empty days / a lighter version of a low-completion activity
   - matchedTitles: the matched original titles
   - recurring: 0.65-0.95 (proportional to completion rate)
   - habit reinforcement: 0.60-0.80
   - retry: 0.50-0.65
   - ★ With 2 repeats confidence must be 0.75+, with 3+ repeats 0.60+.

6. **Seasonal suggestion**: a concrete activity fitting the current season/culture in Korea
   - title e.g.: "Cherry blossom walk 30 min", "Freestyle swim 30 min", "Autumn leaves hike"
   - matchedTitles: must be an empty array []
   - daysOfWeek: 1-2 days a week
   - confidence: 0.50-0.65
   - ★ At most 1

7. **Habit recovery**: restart an activity they did for 3+ weeks then dropped recently
   - title e.g.: "Wednesday evening workout 1 hour"
   - reason pattern: "You kept this up for N weeks, then missed it this week"
   - matchedTitles: that activity's history
   - confidence: 0.70-0.85

8. **Balance suggestion**: when one category is 60%+, recommend a concrete activity from a neglected category
   - title e.g.: "Weekend yoga 30 min", "Evening walk 20 min"
   - matchedTitles: empty array []
   - confidence: 0.55-0.70
   - ★ At most 1

${PROMPT_OUTPUT_DISCIPLINE_EN}

## Rules
- ★★★ Suggest exactly 5. Draw from the 8 types to always fill 5. An empty array is allowed only when there are fewer than 3 data points
- ★ Mix diverse types (never 2+ of the same type, except type 5 recurring patterns which may appear twice)
- ★ If there are missed routines, include at least 1
- ★ Never use type 3 without weather info
- ★ Seasonal: at most 1, matchedTitles must be an empty array
- ★ Balance: at most 1, matchedTitles must be an empty array
- ★ Avoid suggestions similar to what the user has dismissed
- ★ Recurring patterns need the same title ${minOccurrences}+ times (confidence 0.75+ when only 2)
- ★ Progression (type 4) needs only 2 occurrences
- ★ Items that appear only once are never a pattern
- ★ reason must include at least 1 numeric evidence (e.g. "4 weeks straight", "85% completion", "3 times in a row")
- Analyze weekday patterns → daysOfWeek; if there's a time → scheduledTime (HH:mm)

## Examples

Missed routine:
→ title:"Workout", daysOfWeek:["WED"], scheduledTime:"07:00", confidence:0.85, reason:"You've worked out every Wednesday for 3 weeks, but not yet this week! Ready to jump back in?", matchedTitles:["Workout","Workout","Workout"]

Time-slot routine:
→ title:"Morning reading 30 min", daysOfWeek:["MON","WED","FRI"], scheduledTime:"08:00", confidence:0.70, reason:"Your morning completion rate is a strong 85%! Reading in the morning could stick just as well.", matchedTitles:["Read 1 hour"]

Level up:
→ title:"Run 7km", daysOfWeek:["THU"], scheduledTime:"07:00", confidence:0.80, reason:"You've built up from 3km to 5km! How about 7km next?", matchedTitles:["Run 3km","Run 5km"]

Habit recovery:
→ title:"Evening stretch 15 min", daysOfWeek:["MON","WED","FRI"], scheduledTime:"22:00", confidence:0.75, reason:"You stretched 4 weeks in a row, then missed this week! Ease back in with just 15 minutes.", matchedTitles:["Stretching","Stretching","Stretching"]

Balance suggestion:
→ title:"Weekend yoga 30 min", daysOfWeek:["SAT"], scheduledTime:"10:00", confidence:0.60, reason:"Work items make up 72% of your list. How about yoga this weekend to recharge?", matchedTitles:[]

Seasonal suggestion:
→ title:"Cherry blossom walk 30 min", daysOfWeek:["SAT"], scheduledTime:null, confidence:0.55, reason:"It's cherry blossom season! How about a 30-minute walk in a nearby park this weekend?", matchedTitles:[]

No pattern (not enough data):
→ [] (must be an empty array when there are only one-off to-dos)`;

	const prompt = `Analyze the user data below and suggest personalized routines.

## User profile
Streak: ${context.streak}
Today: ${context.currentDate}

## Completion rate by day
${context.dayCompletionRates}

## Completion rate by time slot
${context.timeCompletionRates}

## Completion rate by category
${context.categoryRates}

## Missed routines (regular activities skipped this week)
${missingRoutinesText}
${weatherSection}${reportSection}${historySection}
## To-do history (date|title|time|done|category)
${todoLines}

Respond in JSON. Write title and reason in English.`;

	return { system, prompt };
}

function buildHistorySectionEn(history: SuggestionHistoryItem[]): string {
	if (history.length === 0) {
		return "";
	}

	const accepted = history
		.filter((h) => h.status === "ACCEPTED")
		.map((h) => h.title);
	const dismissed = history
		.filter((h) => h.status === "DISMISSED")
		.map((h) => h.title);

	const lines: string[] = ["\n## User's suggestion history"];
	if (accepted.length > 0) {
		lines.push(`Accepted: ${accepted.join(", ")}`);
	}
	if (dismissed.length > 0) {
		lines.push(`Dismissed: ${dismissed.join(", ")}`);
	}
	lines.push(
		"→ Avoid suggestions similar to dismissed ones; favor patterns similar to accepted ones.\n",
	);
	return lines.join("\n");
}
