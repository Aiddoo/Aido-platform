import { hasOnlyGroundedNumbers, type NumberEvidence } from "../grounding/grounded-numbers.js";

/** 문장 끝 부호 뒤의 공백에서 나눈다. */
const SENTENCE_BREAK = /(?<=[.!?])\s+/;

/**
 * 리포트 문장 중 근거 밖 숫자가 있는 문장을 뺀다.
 * 문장 하나만 지우면 나머지 문장은 그대로 쓸 수 있어 전체를 폴백으로 바꾸지 않는다.
 */
export function keepGroundedSentences(text: string, evidence: NumberEvidence): string {
  return text
    .split(SENTENCE_BREAK)
    .filter((sentence) => sentence.trim() !== "" && hasOnlyGroundedNumbers(sentence, evidence))
    .join(" ");
}
