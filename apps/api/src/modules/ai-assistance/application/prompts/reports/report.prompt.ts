import type { BuildReportPromptOptions, ReportPrompt } from "./report.prompt.types.js";
export type { BuildReportPromptOptions, ReportPrompt } from "./report.prompt.types.js";
import { z } from "zod";

import type { SupportedLocale } from "#api/shared/domain/locale";
import {
  PROMPT_OUTPUT_DISCIPLINE,
  PROMPT_SECURITY_GUARD,
} from "#api/shared/domain/prompt/prompt-sections";
import { encodeUntrustedJson } from "#api/shared/domain/prompt/sanitize";

import type {
  AggregatedReportData,
  ReportType,
} from "../../../domain/types/reports/ai-report.types.js";
import { buildReportContext } from "./report-context.js";
import { buildReportPromptEn } from "./report.prompt.en.js";

export const reportAiResponseSchema = z.object({
  summary: z.string().describe("한국어 주간/월간 요약: 활동 있으면 4-6문장, 없으면 2-3문장"),
  tips: z.array(z.string()).min(1).max(3).describe("실천 가능한 팁 1-3개 (한국어)"),
});

export type ReportAiResponse = z.infer<typeof reportAiResponseSchema>;

export const reportAiResponseSchemaEn = z.object({
  summary: z
    .string()
    .describe("English weekly/monthly summary: 4-6 sentences with activity, 2-3 without activity"),
  tips: z.array(z.string()).min(1).max(3).describe("1-3 actionable tips (English)"),
});

export function getReportAiResponseSchema(locale: SupportedLocale) {
  return reportPromptCatalog[locale].schema;
}

const REPORT_SYSTEM = `<role>
너는 "아이도냥", 사용자의 생산성 코치다. 확인된 기록을 바탕으로 다음 작은 행동을 제안한다.
- 친근하고 간결하게 쓴다. "~냥"은 전체 결과에 최대 한 번이고 동물·물고기 비유와 캐치프레이즈를 넣지 않는다.
- 달성률이 낮아도 비난하지 않고 작은 성공을 구체적으로 짚는다.
</role>

${PROMPT_SECURITY_GUARD}

<rules>
## 기록 기반 행동 제안
- 사용자 심리·감정·습관 정착을 진단하지 않는다. 작은 행동이나 선택 가능한 단서를 제안할 수 있으나 효과를 보장하지 않는다.
- focus의 한 분석축에서 완료 근거가 가장 분명한 관찰 하나를 선택하고 바로 시도할 작은 행동과 연결한다. 카테고리와 요일·시각을 연결하거나 인과관계를 만들지 않는다. context에 없는 시각·활동 장소·출퇴근·기존 루틴을 말하지 않는다.
- summary는 활동이 있으면 4~6문장, 없으면 2~3문장이다.
- tips는 1~3개다. 각 팁은 [조건부의 작은 행동] + [focus에서 확인된 등록·완료 근거]를 연결한다. 날짜·시각·장소를 채우기 위해 만들지 않는다. 정보가 없으면 사용자가 고를 선택으로만 표현한다.
- 실제 기록·서버 통계에 없는 습관, 소요시간, 시각, 활동 장소를 사용자 사실로 만들지 않는다. when/where 근거가 없으면 사용자가 고를 조건부 단서로 제안한다.
- 작은 행동이나 분량은 앞으로 시도할 제안으로 표현하고 이미 해온 행동처럼 말하지 않는다. 활동이 없으면 2~3문장으로 기록 없음만 설명한다. 휴식·바쁜 사정·커피·아침 생활을 단정하지 않고 사용자가 고를 작은 할 일 하나를 앱에 등록하도록 조건부로 제안한다. 종이 기록이나 모호한 목표 설정을 대신 권하지 않는다.
- "꾸준히 해봐", "루틴을 만들어봐"처럼 누구에게나 맞는 조언은 금지한다.
- 이전 팁의 효과는 현재 데이터가 직접 뒷받침할 때만 비교한다. 인과관계를 추측하지 않는다.
- 기간 비교는 prevCompletionRate가 있는 전체 달성률에만 한다. focus의 현재 카테고리·요일 수치에는 이전 자료가 없으므로 유지·증가·감소·꾸준함을 단정하지 않는다.
- 원래 분량이 없으면 "절반으로 줄이기" 같은 상대 조정을 만들지 않는다. "원한다면 한 페이지 읽기를 새 할 일로 등록"처럼 작은 분량을 새 선택으로만 제안한다.
- 주간은 다음 7일의 작은 실행, 월간은 다음 달의 큰 전략에 초점을 둔다.
</rules>

<quality_check>
- 모든 사실과 숫자가 context_json에 존재하는가?
- 가장 강한 행동 패턴 1개와 바로 실행할 팁이 연결되는가?
- 같은 내용을 summary와 tips에서 반복하지 않았는가?
- 아이도냥 말투가 정보 전달을 방해하지 않는가?
</quality_check>

${PROMPT_OUTPUT_DISCIPLINE}`;

function buildReportPromptKo(
  data: AggregatedReportData,
  periodLabel: string,
  type: ReportType,
  options: BuildReportPromptOptions,
): ReportPrompt {
  const activityTask = data.hasActivity
    ? `context_json의 기간 데이터를 분석해 사용자가 다음 ${type === "WEEKLY" ? "7일" : "달"}에 바로 적용할 코칭을 작성한다.`
    : `context_json의 기간에는 등록된 할 일이 없다. 휴식이나 생활을 추측하지 말고 2~3문장으로 기록이 없음을 설명한다. 다음 기간에 사용자가 고를 작은 할 일 하나를 앱에 등록하도록 조건부로 제안한다.`;

  return {
    system: REPORT_SYSTEM,
    prompt: `<context_json>\n${encodeUntrustedJson(
      buildReportContext(data, periodLabel, type, options, "ko"),
    )}\n</context_json>\n<task>${activityTask} 내부적으로 근거를 점검한 뒤 구조화 결과만 반환한다.</task>`,
  };
}

export const reportPromptCatalog = {
  ko: { build: buildReportPromptKo, schema: reportAiResponseSchema },
  en: { build: buildReportPromptEn, schema: reportAiResponseSchemaEn },
} satisfies Record<
  SupportedLocale,
  { readonly build: typeof buildReportPromptKo; readonly schema: typeof reportAiResponseSchema }
>;

export function buildReportPrompt(
  data: AggregatedReportData,
  periodLabel: string,
  type: ReportType,
  options: BuildReportPromptOptions,
  locale: SupportedLocale = "ko",
): ReportPrompt {
  return reportPromptCatalog[locale].build(data, periodLabel, type, options);
}
