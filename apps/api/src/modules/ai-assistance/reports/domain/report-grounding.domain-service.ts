import {
  hasOnlyGroundedNumbers,
  type NumberEvidence,
} from "../../shared/domain/grounded-numbers.domain-service.js";

/** 문장 끝 부호 뒤의 공백에서 나눈다. */
const SENTENCE_BREAK = /(?<=[.!?])\s+/;

export interface ReportNumberEvidence {
  readonly overallNumbers: readonly number[];
  readonly items: readonly { readonly key: string; readonly numbers: readonly number[] }[];
  /** 사용자가 쓴 이름·기간 라벨. 그 안의 분량을 그대로 다시 쓴 것은 근거로 본다 */
  readonly quotedTexts: readonly string[];
}

function keepGroundedSentences(text: string, evidence: NumberEvidence): string {
  return text
    .split(SENTENCE_BREAK)
    .filter((sentence) => sentence.trim() !== "" && hasOnlyGroundedNumbers(sentence, evidence))
    .join(" ");
}

/**
 * insight 숫자는 insightKey 항목과 전체 통계에서만 온다. 다른 항목의 숫자("운동은 12개 중 11개"에
 * 업무 수치)를 붙인 문장은 뺀다. 모르는 key나 null이면 전체 통계로만 본다.
 */
export function keepGroundedInsight(
  insight: string,
  insightKey: string | null,
  evidence: ReportNumberEvidence,
): string {
  const item = evidence.items.find(({ key }) => key === insightKey);
  return keepGroundedSentences(insight, {
    numbers: [...evidence.overallNumbers, ...(item?.numbers ?? [])],
    quotedTexts: evidence.quotedTexts,
  });
}

/** tip은 숫자를 쓰지 않는다. 사용자가 쓴 이름 속 분량("PT 3회권")만 허용한다. */
export function isNumberFreeTip(tip: string, quotedTexts: readonly string[]): boolean {
  return hasOnlyGroundedNumbers(tip, { numbers: [], quotedTexts });
}
