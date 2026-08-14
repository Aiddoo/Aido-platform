import dayjs from "dayjs";

import {
	PROMPT_OUTPUT_DISCIPLINE_EN,
	PROMPT_SECURITY_GUARD_EN,
} from "@/shared/domain/prompt/prompt-sections";
import { encodeUntrustedJson, sanitizeMemoForPrompt } from "@/shared/domain/prompt/sanitize";

import type { CategoryInfo, ParseMemoPrompt } from "./parse-memo.prompt";
import { buildTimeContext, buildTimeRulesTextEn } from "./time-rules";

/**
 * buildParseMemoPrompt의 영어 버전 — en 로케일 사용자의 영어 메모용.
 * 구조·규칙·예시 골격은 한국어 버전과 동일하다.
 */
export function buildParseMemoPromptEn(
	content: string,
	tz: string = "UTC",
	now: Date = new Date(),
	categories: CategoryInfo[] = [],
): ParseMemoPrompt {
	const ctx = buildTimeContext(tz, now, "en");
	const timeRules = buildTimeRulesTextEn(ctx);
	const safeContent = sanitizeMemoForPrompt(content);

	const categoryRule =
		categories.length > 0
			? "- For each to-do, use only an id present in context.categories, choosing the closest semantic match."
			: "";

	const system = `<role>
You are an expert at analyzing a memo and turning it into an actionable to-do list.
Extract 1-5 independent to-dos from the memo, and for each to-do extract 0-5 concrete sub-steps (items) when present.
</role>

${PROMPT_SECURITY_GUARD_EN}

<rules>
## Splitting rules (★very important)
- Different contexts or topics become separate to-dos.
- One big task with sub-steps (do A, then B, then C) must be 1 to-do + multiple items. Never split sub-steps into separate to-dos.
- If the memo has 6+ independent topics, group related work into items and compress to at most 5 to-dos.
- Bad: "Get project mockups", "Implement project", "Test project" → 3 separate to-dos (X)
- Good: "Project work" + items: ["Get mockups", "Implement", "Test"] → 1 to-do (O)

## Title rules
- Keep only the core action, concise. Strip date/time expressions from the title.
- Remove filler words, exclamations, and emojis.
- Good: "Book doctor appointment", "Prepare presentation", "Buy milk"
- Bad: "Go to the doctor tomorrow", "Let's prepare the presentation well", "Need to buy milk"

## Sub-step (items) rules
- Include only concrete, actionable steps.
- Vague steps like "do it well", "try hard" are forbidden.
- Simple single tasks (e.g. "Buy milk", "Make a call") get an empty items array.
- Never repeat the title inside items. Items must be sub-steps of the title.
- Good: items: ["Write 10 slides", "Do 1 rehearsal"]
- Bad: items: ["Prepare well"], items: ["Prepare presentation"] (when the title is already "Prepare presentation")

## Special inputs
- Very short input (1-3 words): use it as the to-do title as-is. Always create exactly 1 to-do.
- Non-task memos (feelings, diary, musings): interpret as the most reasonable action and create 1 to-do.
  e.g. "beautiful day, I want to take a walk" → title: "Take a walk"
  e.g. "organizing the meeting notes was exhausting" → title: "Organize meeting notes"
${categoryRule}
## Date/time rules
${timeRules}

## Examples

### Example 1: mixed memo — sub-steps must be grouped as items
Input: "project is due Friday, need to get mockups from the designer, build the frontend and run tests. also buy mom a gift"
Output:
{"todos":[{"title":"Project deadline prep","startDate":"${ctx.datetime.slice(0, 10)}","endDate":"${ctx.nextWeekSun.slice(0, 10)}","scheduledTime":null,"isAllDay":true,"isRecurring":false,"recurrence":null,"items":[{"title":"Request mockups from designer"},{"title":"Build frontend"},{"title":"Run tests"}]},{"title":"Buy gift for mom","startDate":"${ctx.datetime.slice(0, 10)}","endDate":null,"scheduledTime":null,"isAllDay":true,"isRecurring":false,"recurrence":null,"items":[]}]}

### Example 2: simple list (no items)
Input: "buy milk stop by the dry cleaner go to the bank"
Output:
{"todos":[{"title":"Buy milk","startDate":"${ctx.datetime.slice(0, 10)}","endDate":null,"scheduledTime":null,"isAllDay":true,"isRecurring":false,"recurrence":null,"items":[]},{"title":"Stop by dry cleaner","startDate":"${ctx.datetime.slice(0, 10)}","endDate":null,"scheduledTime":null,"isAllDay":true,"isRecurring":false,"recurrence":null,"items":[]},{"title":"Go to the bank","startDate":"${ctx.datetime.slice(0, 10)}","endDate":null,"scheduledTime":null,"isAllDay":true,"isRecurring":false,"recurrence":null,"items":[]}]}

### Example 3: time expressions + recurrence
Input: "workout every Mon/Wed/Fri at 7am and dentist tomorrow at 3pm"
Output:
{"todos":[{"title":"Workout","startDate":"${ctx.datetime.slice(0, 10)}","endDate":null,"scheduledTime":"07:00","isAllDay":false,"isRecurring":true,"recurrence":{"daysOfWeek":["MON","WED","FRI"],"endDate":"${ctx.fourWeeksLater}"},"items":[]},{"title":"Dentist appointment","startDate":"${dayjs(now).tz(tz).add(1, "day").format("YYYY-MM-DD")}","endDate":null,"scheduledTime":"15:00","isAllDay":false,"isRecurring":false,"recurrence":null,"items":[]}]}

</rules>

<quality_check>
- Return 1-5 to-dos and 0-5 items per to-do.
- Titles and items do not duplicate each other and each is actionable.
- scheduledTime/isAllDay and isRecurring/recurrence are mutually consistent.
- Dates and weekdays agree with the current time and timezone.
</quality_check>

${PROMPT_OUTPUT_DISCIPLINE_EN}`;

	const prompt = `<context_json>
${encodeUntrustedJson({ timezone: tz, categories })}
</context_json>
<user_input_json>
${encodeUntrustedJson({ memo: safeContent })}
</user_input_json>
<task>Convert the memo into an actionable to-do list. Check quality internally, then return only the structured result.</task>`;

	return { system, prompt };
}
