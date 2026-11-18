import type { DayOfWeek, Localized, SupportedLocale } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import type { SuggestionCandidate } from "../../domain/suggestion-candidates.domain-service.js";
import { suggestionContextTranslations } from "./suggestion-context.messages.js";

interface SuggestionReasonCopy {
  readonly repeat: (candidate: SuggestionCandidate, days: readonly DayOfWeek[]) => string;
  readonly starter: (
    todoCount: number,
    candidate: SuggestionCandidate,
    days: readonly DayOfWeek[],
  ) => string;
}

const EN_DAY_LIST = new Intl.ListFormat("en", { type: "conjunction" });

function formatDays(locale: SupportedLocale, days: readonly DayOfWeek[]): string {
  return match(locale)
    .with("ko", () =>
      days.map((day) => `${suggestionContextTranslations.ko.days[day]}요일`).join("·"),
    )
    .with("en", () =>
      EN_DAY_LIST.format(days.map((day) => suggestionContextTranslations.en.days[day])),
    )
    .exhaustive();
}

/** 출시 앱(≤1.15)이 보이는 제안 근거. 모델 글 없이 기록 수치로만 만든다. */
export const suggestionReasonCopy: Localized<SuggestionReasonCopy> = {
  ko: {
    repeat: (candidate, days) =>
      `최근 '${candidate.title}' 활동을 ${candidate.occurrences}번 기록하고 ${candidate.completed}번 완료했어요. ${formatDays("ko", days)}에 반복으로 등록해두면 매번 다시 입력하지 않아도 돼요.`,
    starter: (todoCount, candidate, days) =>
      `기록이 아직 ${todoCount}개라 패턴으로 보기는 일러요. 이미 해본 '${candidate.title}' 활동이니 ${formatDays("ko", days)}에 다시 해보세요.`,
  },
  en: {
    repeat: (candidate, days) =>
      `You added '${candidate.title}' ${candidate.occurrences} times recently and completed it ${candidate.completed} times. If you set it to repeat on ${formatDays("en", days)}, you won't have to add it again each time.`,
    starter: (todoCount, candidate, days) =>
      `You only have ${todoCount} ${todoCount === 1 ? "record" : "records"} so far, which is too early to call a pattern. Since you've already done '${candidate.title}', here's a suggestion to try it again on ${formatDays("en", days)}.`,
  },
};
