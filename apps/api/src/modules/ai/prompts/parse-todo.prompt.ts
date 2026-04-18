import {
	PROMPT_OUTPUT_DISCIPLINE,
	PROMPT_SECURITY_GUARD,
} from "../shared/prompt-sections";
import type { CategoryInfo } from "./parse-memo.prompt";
import { sanitizeForPrompt } from "./sanitize";
import { buildTimeContext, buildTimeRulesText } from "./time-rules";

export interface ParseTodoPrompt {
	system: string;
	prompt: string;
}

export function buildParseTodoPrompt(
	text: string,
	tz: string = "UTC",
	now: Date = new Date(),
	categories: CategoryInfo[] = [],
): ParseTodoPrompt {
	const ctx = buildTimeContext(tz, now);
	const timeRules = buildTimeRulesText(ctx);
	const safeText = sanitizeForPrompt(text);

	const categorySection =
		categories.length > 0
			? `\n## 카테고리 배정 (★필수)
사용자의 카테고리 목록: ${categories.map((c) => `${c.id}:"${c.name}"`).join(", ")}
입력 내용을 보고 반드시 위 목록에서 가장 적절한 카테고리의 ID 숫자를 categoryId에 넣으세요.
판단이 어려우면 가장 범용적인 카테고리를 선택하세요. 0이나 null을 넣지 마세요.\n`
			: "";

	const system = `당신은 한국어 자연어 입력을 구조화된 할 일(Todo) 데이터로 변환하는 전문가입니다.

${PROMPT_SECURITY_GUARD}

## 제목(title) 작성 규칙
- 날짜/시간 표현을 제외한 핵심 행동만 간결하게 작성합니다.
- 좋은 예: "팀 미팅", "운동", "병원 예약"
- 나쁜 예: "내일 오후 3시에 팀 미팅", "운동하기로 함"
${categorySection}
## 날짜/시간 규칙
${timeRules}

## 주 단위 기간 예시

예시 1: "이번주 운동" (today=${ctx.datetime.slice(0, 10)})
→ {"title":"운동","startDate":"${ctx.datetime.slice(0, 10)}","endDate":null,"scheduledTime":null,"isAllDay":true,"isRecurring":true,"recurrence":{"daysOfWeek":${JSON.stringify(ctx.remainingDays)},"endDate":"${ctx.thisWeekSun}"}}

예시 2: "다음주 회의"
→ {"title":"회의","startDate":"${ctx.nextWeekMon}","endDate":null,"scheduledTime":null,"isAllDay":true,"isRecurring":true,"recurrence":{"daysOfWeek":["MON","TUE","WED","THU","FRI","SAT","SUN"],"endDate":"${ctx.nextWeekSun}"}}

예시 3: "다음주말 영화"
→ {"title":"영화","startDate":"${ctx.nextWeekSat}","endDate":null,"scheduledTime":null,"isAllDay":true,"isRecurring":true,"recurrence":{"daysOfWeek":["SAT","SUN"],"endDate":"${ctx.nextWeekSun}"}}

예시 4: "다다음주 발표"
→ {"title":"발표","startDate":"${ctx.nextNextWeekMon}","endDate":null,"scheduledTime":null,"isAllDay":true,"isRecurring":true,"recurrence":{"daysOfWeek":["MON","TUE","WED","THU","FRI","SAT","SUN"],"endDate":"${ctx.nextNextWeekSun}"}}

${PROMPT_OUTPUT_DISCIPLINE}

## 출력 형식
{"title":"string","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD|null","scheduledTime":"HH:mm|null","isAllDay":boolean,"isRecurring":boolean,"recurrence":{"daysOfWeek":["MON"],"endDate":"YYYY-MM-DD"}|null}`;

	const prompt = `다음 입력을 할 일로 변환해주세요.

입력: "${safeText}"`;

	return { system, prompt };
}
