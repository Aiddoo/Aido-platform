import dayjs from "dayjs";

import {
	PROMPT_OUTPUT_DISCIPLINE,
	PROMPT_SECURITY_GUARD,
} from "@/shared/domain/prompt/prompt-sections";
import { encodeUntrustedJson, sanitizeMemoForPrompt } from "@/shared/domain/prompt/sanitize";

import { buildTimeContext, buildTimeRulesText } from "./time-rules";

export interface ParseMemoPrompt {
	system: string;
	prompt: string;
}

export interface CategoryInfo {
	id: number;
	name: string;
}

export function buildParseMemoPrompt(
	content: string,
	tz: string = "UTC",
	now: Date = new Date(),
	categories: CategoryInfo[] = [],
): ParseMemoPrompt {
	const ctx = buildTimeContext(tz, now);
	const timeRules = buildTimeRulesText(ctx);
	const safeContent = sanitizeMemoForPrompt(content);

	const categoryRule =
		categories.length > 0
			? "- 각 todo의 categoryId는 context.categories에 실제로 있는 id 중 의미가 가장 가까운 값만 사용한다."
			: "";

	const system = `<role>
당신은 한국어 메모를 분석하여 실행 가능한 할 일(Todo) 목록으로 변환하는 전문가입니다.
메모에서 독립적인 할 일을 1~5개 추출하고, 각 할 일에 구체적인 실행 단계가 있으면 서브투두(items)를 0~5개 추출합니다.
</role>

${PROMPT_SECURITY_GUARD}

<rules>
## 분리 규칙 (★매우 중요)
- 서로 다른 맥락이나 주제는 별도의 Todo로 분리합니다.
- 하나의 큰 작업에 세부 단계(A를 하고, B를 하고, C를 해야 함)가 있으면 반드시 1개의 Todo + 여러 items로 구성합니다. 세부 단계를 별도 Todo로 분리하지 마세요.
- 메모에 6개 이상의 독립적인 주제가 있으면, 관련 작업을 items로 묶어 최대 5개 Todo로 압축합니다.
- 나쁜 예: "프로젝트 시안 받기", "프로젝트 구현", "프로젝트 테스트" → 3개 별도 Todo (X)
- 좋은 예: "프로젝트 진행" + items: ["시안 받기", "구현", "테스트"] → 1개 Todo (O)

## 제목(title) 작성 규칙
- 핵심 행동만 간결하게 작성합니다. 날짜/시간 표현은 제목에서 제외합니다.
- 조사, 접속사, 감탄사, 이모지를 제거합니다.
- 좋은 예: "병원 예약", "프레젠테이션 준비", "우유 구매"
- 나쁜 예: "내일 병원에 가기", "프레젠테이션을 잘 준비하자", "우유를 사야 함"

## 서브투두(items) 작성 규칙
- 구체적이고 실행 가능한 단계만 포함합니다.
- "잘 하기", "열심히 하기" 같은 추상적 표현은 금지합니다.
- 단순한 단일 작업(예: "우유 사기", "전화하기")은 items를 비워둡니다.
- 제목과 동일한 내용을 items에 넣지 마세요. items는 제목의 하위 단계여야 합니다.
- 좋은 예: items: ["슬라이드 10장 작성", "리허설 1회 진행"]
- 나쁜 예: items: ["잘 준비하기"], items: ["발표 준비"] (제목이 이미 "발표 준비"일 때)

## 특수 입력 처리
- 매우 짧은 입력(단어 1~3개): 그대로 todo 제목으로 사용합니다. 반드시 1개의 todo를 생성합니다.
- 할 일이 아닌 메모(감정, 일기, 감상): 가장 합리적인 행동으로 해석하여 1개의 todo를 생성합니다.
  예: "오늘 날씨 좋다 산책 가고 싶다" → title: "산책"
  예: "회의 내용 정리하기 힘들었다" → title: "회의 내용 정리"
${categoryRule}
## 날짜/시간 규칙
${timeRules}

## 예시

### 예시 1: 복합 메모 — 세부 단계는 반드시 items로 묶기
입력: "프로젝트 마감이 금요일인데 디자이너한테 시안 받고 프론트 구현하고 테스트 돌려야 함. 그리고 엄마 선물 사기"
출력:
{"todos":[{"title":"프로젝트 마감 준비","startDate":"${ctx.datetime.slice(0, 10)}","endDate":"${ctx.nextWeekSun.slice(0, 10)}","scheduledTime":null,"isAllDay":true,"isRecurring":false,"recurrence":null,"items":[{"title":"디자이너에게 시안 요청"},{"title":"프론트엔드 구현"},{"title":"테스트 진행"}]},{"title":"엄마 선물 구매","startDate":"${ctx.datetime.slice(0, 10)}","endDate":null,"scheduledTime":null,"isAllDay":true,"isRecurring":false,"recurrence":null,"items":[]}]}

### 예시 2: 단순 나열 (items 없음)
입력: "우유 사기 세탁소 들리기 은행 가기"
출력:
{"todos":[{"title":"우유 구매","startDate":"${ctx.datetime.slice(0, 10)}","endDate":null,"scheduledTime":null,"isAllDay":true,"isRecurring":false,"recurrence":null,"items":[]},{"title":"세탁소 방문","startDate":"${ctx.datetime.slice(0, 10)}","endDate":null,"scheduledTime":null,"isAllDay":true,"isRecurring":false,"recurrence":null,"items":[]},{"title":"은행 방문","startDate":"${ctx.datetime.slice(0, 10)}","endDate":null,"scheduledTime":null,"isAllDay":true,"isRecurring":false,"recurrence":null,"items":[]}]}

### 예시 3: 시간 표현 + 반복
입력: "매주 월수금 아침 7시에 운동 그리고 내일 오후 3시 치과"
출력:
{"todos":[{"title":"운동","startDate":"${ctx.datetime.slice(0, 10)}","endDate":null,"scheduledTime":"07:00","isAllDay":false,"isRecurring":true,"recurrence":{"daysOfWeek":["MON","WED","FRI"],"endDate":"${ctx.fourWeeksLater}"},"items":[]},{"title":"치과 방문","startDate":"${dayjs(now).tz(tz).add(1, "day").format("YYYY-MM-DD")}","endDate":null,"scheduledTime":"15:00","isAllDay":false,"isRecurring":false,"recurrence":null,"items":[]}]}

</rules>

<quality_check>
- todo는 1~5개, 각 items는 0~5개다.
- 제목과 items가 중복되지 않고 각 항목은 실제 실행 가능한 행동이다.
- scheduledTime과 isAllDay, isRecurring과 recurrence가 서로 모순되지 않는다.
- 날짜·요일은 현재 시각 및 타임존과 일치한다.
</quality_check>

${PROMPT_OUTPUT_DISCIPLINE}`;

	const prompt = `<context_json>
${encodeUntrustedJson({ timezone: tz, categories })}
</context_json>
<user_input_json>
${encodeUntrustedJson({ memo: safeContent })}
</user_input_json>
<task>메모를 실행 가능한 할 일 목록으로 변환한다. 내부적으로 품질을 확인한 뒤 구조화 결과만 반환한다.</task>`;

	return { system, prompt };
}
