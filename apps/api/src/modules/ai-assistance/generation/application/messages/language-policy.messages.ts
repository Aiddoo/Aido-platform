import type { SupportedLocale } from "#api/shared/domain/locale";

/**
 * 출력 언어 규칙. 할 일 제목은 말한 언어 그대로, 설명 문장은 앱 언어로 쓴다.
 * 언어를 더하려면 이 표에 항목을 더하고 작업마다 examples.<locale>을 더한다.
 */
export const LANGUAGE_POLICY_RULES = [
  "TITLES_AS_SPOKEN",
  "PROSE_IN_APP_LANGUAGE",
  "NAMES_AS_WRITTEN",
] as const;

export type LanguagePolicyRule = (typeof LANGUAGE_POLICY_RULES)[number];

const LANGUAGE_POLICY: Readonly<
  Record<SupportedLocale, Readonly<Record<LanguagePolicyRule, string>>>
> = {
  ko: {
    TITLES_AS_SPOKEN:
      '할 일·하위 할 일·메모 제목은 사용자가 말하거나 쓴 언어 그대로 쓰고 번역하지 않는다. 한국어와 영어를 섞어 말했으면 섞인 그대로 둔다(예: "팀 standup 준비").',
    PROSE_IN_APP_LANGUAGE:
      "요약, 핵심 포인트, 정리 제목, 이유처럼 설명하는 문장은 앱 언어인 한국어로 쓴다. 입력이 다른 언어여도 같다.",
    NAMES_AS_WRITTEN: "카테고리 이름·고유명사는 데이터에 적힌 그대로 쓰고 번역하지 않는다.",
  },
  en: {
    TITLES_AS_SPOKEN:
      'Write to-do, sub-item, and memo titles in the language the user spoke or typed, never translated. Keep mixed Korean and English exactly as mixed (e.g. "팀 standup 준비").',
    PROSE_IN_APP_LANGUAGE:
      "Write descriptive text (summaries, key points, digest titles, reasons) in English, the app language, even when the input is in another language.",
    NAMES_AS_WRITTEN: "Keep category names and proper nouns exactly as written in the data.",
  },
};

/** `<language_policy>` 블록 */
export function buildLanguagePolicy(
  locale: SupportedLocale,
  rules: readonly LanguagePolicyRule[],
): string {
  const lines = rules.map((rule) => `- ${LANGUAGE_POLICY[locale][rule]}`);
  return `<language_policy>\n${lines.join("\n")}\n</language_policy>`;
}
