import type { SuggestionPrompt } from "./detect-patterns.prompt.types.js";
export type { SuggestionPrompt } from "./detect-patterns.prompt.types.js";
import { dayOfWeekSchema } from "@aido/api";
import { AI_SUGGESTION_LIMITS, type DayOfWeek } from "@aido/api/vocabulary";
import { z } from "zod";

import type { SupportedLocale } from "#api/shared/domain/locale";
import {
  PROMPT_OUTPUT_DISCIPLINE,
  PROMPT_SECURITY_GUARD,
} from "#api/shared/domain/prompt/prompt-sections";
import { encodeUntrustedJson } from "#api/shared/domain/prompt/sanitize";

import { collectRecordedActivities } from "../../../domain/services/suggestions/recorded-activity-evidence.js";
import type { RecordedActivityEvidence } from "../../../domain/types/suggestions/ai-suggestion.types.js";
import { suggestionContextTranslations } from "../../locale/suggestions/suggestion-context.locale.js";
import type { SuggestionContext } from "../../types/suggestions/suggestion-context.js";
import { buildSuggestionPromptEn } from "./detect-patterns.prompt.en.js";

export const detectedPatternsSchema = z.object({
  patterns: z.array(
    z.object({
      title: z.string().describe("반복 할 일의 제목"),
      daysOfWeek: z.array(dayOfWeekSchema).describe("반복 요일 (예: ['MON', 'WED', 'FRI'])"),
      scheduledTime: z.string().nullable().describe("예약 시간 (HH:mm 형식, 없으면 null)"),
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
      daysOfWeek: z.array(dayOfWeekSchema).describe("Recurring days (e.g. ['MON', 'WED', 'FRI'])"),
      scheduledTime: z.string().nullable().describe("Scheduled time (HH:mm format, null if none)"),
      confidence: z.number().min(0).max(1).describe("Pattern confidence (0.0~1.0)"),
      reason: z.string().describe("Why this pattern was detected (English, 1-2 sentences)"),
      matchedTitles: z
        .array(z.string())
        .describe("Original to-do titles supporting this suggestion"),
    }),
  ),
});

export function getDetectedPatternsSchema(locale: SupportedLocale) {
  return suggestionPromptCatalog[locale].schema;
}

function buildPatternRules(minOccurrences: number): string {
  return `<rules>
- 근거가 강한 제안만 0~5개 반환한다. 개수를 채우기 위해 근거가 약하면 만들지 마.
- title은 수락 즉시 할 일이 되므로 실제 원본 활동 제목과 명시된 분량을 그대로 쓴다. 기록이 "러닝"이면 "러닝", "러닝 30분"이면 "러닝 30분"이다. 미명시 시간·횟수·거리를 추가하지 않는다.
- 같은 제목 반복은 ${minOccurrences}회 이상을 기본 근거로 삼는다. 2회 반복은 confidence 0.75 이상일 때만 허용한다.
- 반복형도 실제 원본 제목을 고른다. 분량을 낮추거나 높이지 않으며, 서로 다른 분량의 기록이 있어도 새 분량을 계산해 만들지 않는다.
- matchedTitles에는 같은 활동을 뒷받침하는 context.todos의 실제 발생을 빠짐없이 원본 title 그대로 복사한다. 같은 제목이 3번 있으면 같은 문자열을 3개 넣고 1개로 합치지 않는다. 실제 근거가 없는 제안은 빈 배열로 둔다.
- recordedActivities가 있으면 서버가 실제 startDate로 계산한 days를 요일 근거로 최우선 사용한다. total은 등록 횟수, completed는 완료 횟수다. MON을 SUN으로 바꾸거나 등록을 완료로 바꾸지 않는다. 반복형 daysOfWeek는 이 활동의 실제 days 안에서 고른다.
- 같은 제목을 실제 기록 수보다 많이 matchedTitles에 넣지 않는다. 기록에 없는 습관·지속시간·요일·시각을 사용자의 과거 행동처럼 만들지 않는다.
- scheduledTime은 해당 활동의 실제 Todo 시각 근거가 없으면 null이다. 기록된 요일에 같은 활동을 다시 할 제안이며, 미명시 시각·분량이나 새 습관을 만들지 않는다.
- reason은 1~2문장이고 실제 등록·완료 횟수와 기록된 요일을 구분해 설명한다. 이어서 같은 요일로 반복 설정하면 재입력을 줄인다는 수락 이점을 연결한다. "N주 연속", 성취감, 꾸준함이나 습관 형성처럼 확인되지 않은 기간·심리를 만들지 않는다.
- weather가 null이면 날씨 제안을 만들지 않는다. 거절한 원본 활동을 시간·분량·표현만 바꿔 다시 제안하지 않는다. 10분 독서를 거절했다면 15분 독서도 제외한다.
- 동일 유형을 반복하지 말고, 시즌·밸런스처럼 matchedTitles가 빈 제안은 합쳐서 최대 2개다.
</rules>`;
}

const STARTER_RULES = `<rules>
- 최근 기록이 1~2개인 시작 단계다. 실제 기록 요일부터 같은 활동을 다시 시도할 제안만 최대 2개 반환하고 같은 활동을 중복하지 않는다.
- title의 활동과 명시된 분량은 원본 그대로 쓴다. "러닝"에 30분을 붙이거나 "러닝 30분"을 10분으로 바꾸지 않는다. 미명시 시간·횟수·거리를 추가하지 않는다.
- 근거가 부족하므로 반복 패턴·꾸준함·장기 습관으로 단정하지 않는다. matchedTitles는 빈 배열, confidence는 0.60 이하로 둔다.
- daysOfWeek는 실제 기록 요일에서 고른다. scheduledTime은 해당 활동의 실제 시각이 없으면 null이다. 새 장소·아침·커피 같은 일상 단서를 만들지 않는다.
- weather가 null이면 날씨를 언급하지 않는다. 수락·거절한 활동을 분량·표현만 바꿔 다시 제안하지 않는다.
</rules>`;

function buildSuggestionPromptKo(
  context: SuggestionContext,
  minOccurrences: number,
): SuggestionPrompt {
  const isStarter =
    context.todos.length > 0 && context.todos.length < AI_SUGGESTION_LIMITS.MIN_OCCURRENCES;
  const mode = isStarter ? "STARTER" : "PATTERN";
  const system = `<role>
너는 사용자의 할 일 데이터를 분석해서 실행 가능한 루틴을 제안하는 코치야.
</role>

${PROMPT_SECURITY_GUARD}

${isStarter ? STARTER_RULES : buildPatternRules(minOccurrences)}

<quality_check>
- suggestionHistory의 ACCEPTED는 이미 수락한 활동이다. 같은 활동은 분량·표현을 바꿔도 다시 추천하지 않는다.
- 활동 제목과 분량은 실제 기록 그대로이며, 미명시 시간·횟수·거리를 붙이지 않았는가?
- 사용자가 수락하자마자 무엇을 해야 할지 분명한가?
- 데이터가 부족한데 패턴이라고 과장하지 않았는가?
- 중복되거나 채우기용 제안은 없는가?
</quality_check>

${PROMPT_OUTPUT_DISCIPLINE}`;

  const prompt = `<context_json>\n${encodeUntrustedJson({
    mode,
    todoCount: context.todos.length,
    ...context,
    recordedActivities: context.recordedActivities ?? collectRecordedActivities(context.todos),
  })}\n</context_json>\n<task>위 사용자 데이터를 분석해서 맞춤 루틴을 제안해줘. 내부적으로 근거를 점검한 뒤 구조화 결과만 반환한다.</task>`;

  return { system, prompt };
}

export const suggestionPromptCatalog = {
  ko: {
    build: buildSuggestionPromptKo,
    schema: detectedPatternsSchema,
    starterReason: (
      count: number,
      evidence: RecordedActivityEvidence,
      recommendedDays: readonly DayOfWeek[],
    ) => {
      const days = recommendedDays
        .map((day) => `${suggestionContextTranslations.ko.days[day]}요일`)
        .join(", ");
      return `최근 기록이 ${count}개라 패턴을 단정하긴 일러요. '${evidence.title}' 등록 ${evidence.occurrences}회·완료 ${evidence.completedOccurrences}회 기록을 참고해, 분량을 새로 정하지 않고 ${days}에 같은 활동을 다시 시도해볼 제안이에요.`;
    },
    repeatReason: (evidence: RecordedActivityEvidence, recommendedDays: readonly DayOfWeek[]) => {
      const observed = evidence.days
        .map(
          ({ day, total, completed }) =>
            `${suggestionContextTranslations.ko.days[day]}요일 등록 ${total}회·완료 ${completed}회`,
        )
        .join(", ");
      const days = recommendedDays
        .map((day) => `${suggestionContextTranslations.ko.days[day]}요일`)
        .join(", ");
      return `최근 '${evidence.title}' 기록 ${evidence.occurrences}회 중 ${evidence.completedOccurrences}회 완료했고, ${observed}였어요. ${days}에 이 활동을 반복 설정하면 매번 다시 입력할 일을 줄일 수 있어요.`;
    },
  },
  en: {
    build: buildSuggestionPromptEn,
    schema: detectedPatternsSchemaEn,
    starterReason: (
      count: number,
      evidence: RecordedActivityEvidence,
      recommendedDays: readonly DayOfWeek[],
    ) => {
      const days = recommendedDays
        .map((day) => suggestionContextTranslations.en.days[day])
        .join(", ");
      return `With ${count} recent ${count === 1 ? "record" : "records"}, it is too early to call this a pattern. Based on '${evidence.title}' (${evidence.occurrences} recorded, ${evidence.completedOccurrences} completed), this is an option to retry the same activity on ${days} without choosing a new amount.`;
    },
    repeatReason: (evidence: RecordedActivityEvidence, recommendedDays: readonly DayOfWeek[]) => {
      const observed = evidence.days
        .map(
          ({ day, total, completed }) =>
            `${suggestionContextTranslations.en.days[day]}: ${total} recorded, ${completed} completed`,
        )
        .join("; ");
      const days = recommendedDays
        .map((day) => suggestionContextTranslations.en.days[day])
        .join(", ");
      return `You completed ${evidence.completedOccurrences} of ${evidence.occurrences} recent records for '${evidence.title}' (${observed}). Setting this activity to repeat on ${days} can reduce entering it again each time.`;
    },
  },
} satisfies Record<
  SupportedLocale,
  {
    readonly build: typeof buildSuggestionPromptKo;
    readonly schema: typeof detectedPatternsSchema;
    readonly starterReason: (
      count: number,
      evidence: RecordedActivityEvidence,
      recommendedDays: readonly DayOfWeek[],
    ) => string;
    readonly repeatReason: (
      evidence: RecordedActivityEvidence,
      recommendedDays: readonly DayOfWeek[],
    ) => string;
  }
>;

export function buildSuggestionPrompt(
  context: SuggestionContext,
  minOccurrences: number,
  locale: SupportedLocale = "ko",
): SuggestionPrompt {
  return suggestionPromptCatalog[locale].build(context, minOccurrences);
}
