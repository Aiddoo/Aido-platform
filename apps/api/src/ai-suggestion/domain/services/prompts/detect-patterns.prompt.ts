import { dayOfWeekSchema } from "@aido/validators";
import { z } from "zod";
import {
	PROMPT_OUTPUT_DISCIPLINE,
	PROMPT_SECURITY_GUARD,
} from "@/shared/domain/prompt/prompt-sections";
import { encodeUntrustedJson } from "@/shared/domain/prompt/sanitize";
import type { SupportedLocale } from "@/shared/presentation/decorators";
import type { SuggestionContext } from "../../types";
import { buildSuggestionPromptEn } from "./detect-patterns.prompt.en";

export const detectedPatternsSchema = z.object({
	patterns: z.array(
		z.object({
			title: z.string().describe("반복 할 일의 제목"),
			daysOfWeek: z
				.array(dayOfWeekSchema)
				.describe("반복 요일 (예: ['MON', 'WED', 'FRI'])"),
			scheduledTime: z
				.string()
				.nullable()
				.describe("예약 시간 (HH:mm 형식, 없으면 null)"),
			confidence: z.number().min(0).max(1).describe("패턴 확신도 (0.0~1.0)"),
			reason: z.string().describe("이 패턴을 감지한 이유 (한국어, 1-2문장)"),
			matchedTitles: z
				.array(z.string())
				.describe("이 패턴과 매칭된 원본 할 일 제목들 (시즌 추천은 빈 배열)"),
		}),
	),
});

export type DetectedPatternsResponse = z.infer<typeof detectedPatternsSchema>;

export const detectedPatternsSchemaEn = z.object({
	patterns: z.array(
		z.object({
			title: z.string().describe("Title of the recurring to-do"),
			daysOfWeek: z
				.array(dayOfWeekSchema)
				.describe("Recurring days (e.g. ['MON', 'WED', 'FRI'])"),
			scheduledTime: z
				.string()
				.nullable()
				.describe("Scheduled time (HH:mm format, null if none)"),
			confidence: z
				.number()
				.min(0)
				.max(1)
				.describe("Pattern confidence (0.0~1.0)"),
			reason: z
				.string()
				.describe("Why this pattern was detected (English, 1-2 sentences)"),
			matchedTitles: z
				.array(z.string())
				.describe("Original to-do titles supporting this suggestion"),
		}),
	),
});

export function getDetectedPatternsSchema(locale: SupportedLocale) {
	return locale === "en" ? detectedPatternsSchemaEn : detectedPatternsSchema;
}

export interface SuggestionPrompt {
	system: string;
	prompt: string;
}

function buildPatternRules(minOccurrences: number): string {
	return `<rules>
- 근거가 강한 제안만 0~5개 반환한다. 개수를 채우기 위해 근거가 약하면 만들지 마.
- title은 수락 즉시 할 일이 되므로 "아침 스트레칭 10분"처럼 구체적인 행동·분량으로 쓴다. 추상적인 "집중 시간", "자기계발 루틴", "운동 계획"은 금지한다.
- 같은 제목 반복은 ${minOccurrences}회 이상을 기본 근거로 삼는다. 2회 반복은 confidence 0.75 이상일 때만 허용한다.
- 목표 상향은 서로 다른 수치의 실제 제목 2개 이상이 있어야 한다.
- matchedTitles에는 context.todos에 있는 원본 title을 정확히 복사하고, 실제 근거가 없는 제안은 빈 배열로 둔다.
- reason은 1~2문장이고 context에 실제 있는 숫자 근거를 포함한다. "N주 연속"처럼 계산할 수 없는 기간을 만들지 않는다.
- weather가 null이면 날씨 제안을 만들지 않는다. 거절 이력과 유사한 제안은 피한다.
- 동일 유형을 반복하지 말고, 시즌·밸런스처럼 matchedTitles가 빈 제안은 합쳐서 최대 2개다.
</rules>`;
}

const STARTER_RULES = `<rules>
- 최근 기록이 1~2개인 시작 단계다. 장기 사용에 도움이 되는 가벼운 시작 제안만 1~2개 반환한다.
- 감지된 반복 패턴으로 단정하지 마. reason에 "반복", "꾸준히", "N주 연속" 같은 허위 근거를 쓰지 않는다.
- title은 기존 기록의 맥락을 참고한 구체적 행동이어야 한다. 5~20분 또는 작은 횟수처럼 부담을 낮춘다.
- matchedTitles는 반드시 빈 배열, confidence는 0.60 이하로 둔다.
- daysOfWeek는 실제로 실행 가능한 요일 1~2개, scheduledTime은 context 근거가 없으면 null이다.
- weather가 null이면 날씨를 언급하지 않는다. 거절 이력과 유사한 제안은 피한다.
</rules>`;

export function buildSuggestionPrompt(
	context: SuggestionContext,
	minOccurrences: number,
	locale: SupportedLocale = "ko",
): SuggestionPrompt {
	if (locale === "en") {
		return buildSuggestionPromptEn(context, minOccurrences);
	}

	const isStarter =
		context.todos.length > 0 && context.todos.length < minOccurrences;
	const mode = isStarter ? "STARTER" : "PATTERN";
	const system = `<role>
너는 사용자의 할 일 데이터를 분석해서 실행 가능한 루틴을 제안하는 코치야.
</role>

${PROMPT_SECURITY_GUARD}

${isStarter ? STARTER_RULES : buildPatternRules(minOccurrences)}

<quality_check>
- 모든 제목·수치·요일·시간 근거가 context_json에 있는가?
- 사용자가 수락하자마자 무엇을 해야 할지 분명한가?
- 데이터가 부족한데 패턴이라고 과장하지 않았는가?
- 중복되거나 채우기용 제안은 없는가?
</quality_check>

${PROMPT_OUTPUT_DISCIPLINE}`;

	const prompt = `<context_json>\n${encodeUntrustedJson({
		mode,
		todoCount: context.todos.length,
		...context,
	})}\n</context_json>\n<task>위 사용자 데이터를 분석해서 맞춤 루틴을 제안해줘. 내부적으로 근거를 점검한 뒤 구조화 결과만 반환한다.</task>`;

	return { system, prompt };
}
