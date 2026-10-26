import type { SupportedLocale } from "#api/shared/domain/locale";

/** 해요체 뒤에 덧붙인 "냥"(예: "올랐어요냥", "등록해보세요 냥"). 어미를 바꾼 "했냥"은 건드리지 않는다. */
const KO_TRAILING_NYANG = /요[ \t]*냥/g;
/** 영어 문장에 끼운 "meow". 영어 리포트는 의성어 말투를 쓰지 않는다. */
const EN_MEOW = /,?[ \t]*\bmeow\b[ \t]*/gi;

/**
 * 리포트 문장의 persona 말투를 자연스러운 문장으로 되돌리는 안전망이다.
 * ko는 해요체 뒤에 붙은 "냥"만 지우고, en은 "meow"를 지운다.
 */
export function normalizeReportPersona(text: string, locale: SupportedLocale): string {
  if (locale === "ko") return text.replace(KO_TRAILING_NYANG, "요");
  return text
    .replace(EN_MEOW, " ")
    .replace(/ {2,}/g, " ")
    .replace(/ +([.!?,])/g, "$1")
    .trim();
}
