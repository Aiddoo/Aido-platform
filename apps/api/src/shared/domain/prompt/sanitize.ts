import { AI_PARSE_LIMITS, MEMO_LIMITS } from "@aido/api/vocabulary";

import { truncateGraphemes } from "../utils/grapheme.util.js";

/**
 * 화면에 보이지 않지만 모델은 읽는 문자. 태그 문자(ASCII smuggling)·보조 변형 선택자·폭 없는 공백·
 * 방향 제어(bidi)·제어 문자로 숨긴 지시나 뒤집힌 표시를 막는다.
 * 이모지 결합(ZWJ·ZWNJ, VS15/16)과 탭·줄바꿈은 사용자 의미라 남긴다.
 */
const INVISIBLE_CHARACTERS =
  /(?![‌‍︀-️])[\p{Default_Ignorable_Code_Point}\p{Bidi_Control}]|(?![\t\n])\p{Cc}/gu;

export function removeInvisibleCharacters(value: string): string {
  return value.replace(INVISIBLE_CHARACTERS, "");
}

function normalizeUntrustedText(input: string): string {
  return removeInvisibleCharacters(input.normalize("NFKC").replace(/\r\n?/g, "\n"));
}

/**
 * 단문 입력(parse-todo). NFKC로 전각 태그 같은 유사 문자를 정규화하고 보이지 않는 문자를 지운 뒤
 * 한 줄로 만들어 요청 계약과 같은 상한으로 자른다. 의미를 이루는 기호(C#, 제네릭, 경로)는 남기고,
 * 프롬프트 경계 보호는 encodeUntrustedJson이 맡는다.
 */
export function sanitizeForPrompt(
  input: string,
  maxLength: number = AI_PARSE_LIMITS.TODO_TEXT_MAX_LENGTH,
): string {
  return truncateGraphemes(normalizeUntrustedText(input).replace(/\n+/g, " ").trim(), maxLength);
}

/** 장문 메모(parse-memo). 줄바꿈·리스트 구조를 남기고 요청 계약 길이까지만 둔다. */
export function sanitizeMemoForPrompt(input: string): string {
  return truncateGraphemes(normalizeUntrustedText(input).trim(), MEMO_LIMITS.MAX_CONTENT_LENGTH);
}

/**
 * 신뢰할 수 없는 값을 프롬프트의 데이터 블록에 넣을 JSON으로 만든다. `<`·`>`·`&`를 이스케이프해
 * 사용자 문자열이 블록 태그를 닫거나 새 태그를 열지 못하게 하고(JSON.parse로 원래 값이 복원된다),
 * 저장된 카테고리 이름·제목처럼 sanitize를 거치지 않은 문자열의 보이지 않는 문자도 지운다.
 */
export function encodeUntrustedJson(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, field: unknown) =>
      typeof field === "string" ? removeInvisibleCharacters(field) : field,
    2,
  )
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
