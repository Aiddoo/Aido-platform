import type { DayOfWeek } from "@aido/api/vocabulary";

import type { SupportedLocale } from "#api/shared/domain/locale";

import type { SuggestionCandidate } from "../../../domain/services/suggestions/suggestion-candidates.js";
import { suggestionContextTranslations } from "./suggestion-context.locale.js";

interface SuggestionReasonCopy {
  readonly repeat: (candidate: SuggestionCandidate, days: readonly DayOfWeek[]) => string;
  readonly starter: (
    todoCount: number,
    candidate: SuggestionCandidate,
    days: readonly DayOfWeek[],
  ) => string;
}

const dayList = (locale: SupportedLocale, days: readonly DayOfWeek[]) =>
  days
    .map((day) =>
      locale === "ko"
        ? `${suggestionContextTranslations.ko.days[day]}요일`
        : suggestionContextTranslations.en.days[day],
    )
    .join(locale === "ko" ? "·" : ", ");

/** 모델 사유가 근거 수치를 벗어났을 때 쓰는 서버 문장. 기록 수치만 쓴다. */
export const suggestionReasonCopy: Readonly<Record<SupportedLocale, SuggestionReasonCopy>> = {
  ko: {
    repeat: (candidate, days) =>
      `최근 '${candidate.title}' 활동을 ${candidate.occurrences}번 기록하고 ${candidate.completed}번 완료했어요. ${dayList("ko", days)}에 반복으로 등록해두면 매번 다시 입력하지 않아도 돼요.`,
    starter: (todoCount, candidate, days) =>
      `기록이 아직 ${todoCount}개라 패턴으로 보기는 일러요. 이미 해본 '${candidate.title}' 활동을 ${dayList("ko", days)}에 다시 해볼 수 있게 제안해요.`,
  },
  en: {
    repeat: (candidate, days) =>
      `You recorded '${candidate.title}' ${candidate.occurrences} times recently and completed it ${candidate.completed} times. Repeating it on ${dayList("en", days)} saves entering it again each time.`,
    starter: (todoCount, candidate, days) =>
      `With only ${todoCount} recent records it is too early to call this a pattern, so this suggests trying '${candidate.title}' again on ${dayList("en", days)}.`,
  },
};
