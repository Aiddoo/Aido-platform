import {
  hasOnlyGroundedNumbers,
  type NumberEvidence,
} from "../../shared/domain/grounded-numbers.domain-service.js";

/** 문장 끝 부호 뒤의 공백에서 나눈다. */
const SENTENCE_BREAK = /(?<=[.!?])\s+/;
/** 앞이 글자·숫자인 따옴표는 "don't"·"users'" 같은 아포스트로피라 여는 따옴표로 보지 않는다. */
const OPENING_QUOTE = /(?<![\p{L}\p{N}])['‘]/gu;
const CLOSING_QUOTE = /['’]/u;

export interface ReportEvidence {
  readonly overallNumbers: readonly number[];
  readonly items: readonly { readonly key: string; readonly numbers: readonly number[] }[];
  /** 사용자가 쓴 이름·기간 라벨. 그 안의 분량을 그대로 다시 쓴 것과 따옴표로 감싼 이 이름만 근거로 본다 */
  readonly quotedTexts: readonly string[];
}

/**
 * 작은따옴표로 감싼 이름이 모두 근거 이름인지 본다. 프롬프트 예시 이름('Workout')을 옮겨 쓴 문장을 막는다.
 * 근거 이름 바로 뒤가 닫는 따옴표면 이름 안 아포스트로피("Mom's list")와 뒤 조사("'운동'은")도 통과한다.
 */
export function hasOnlyGroundedNames(text: string, groundedNames: readonly string[]): boolean {
  let checkedUntil = 0;
  for (const { index } of text.matchAll(OPENING_QUOTE)) {
    if (index < checkedUntil) {
      continue;
    }
    const nameStart = index + 1;
    const name = groundedNames.find(
      (candidate) =>
        text.startsWith(candidate, nameStart) &&
        CLOSING_QUOTE.test(text.charAt(nameStart + candidate.length)),
    );
    if (name == null) {
      // 닫는 따옴표가 없으면 감싼 이름이 아니다("'90s").
      return !CLOSING_QUOTE.test(text.slice(nameStart));
    }
    checkedUntil = nameStart + name.length + 1;
  }
  return true;
}

function keepGroundedSentences(text: string, evidence: NumberEvidence): string {
  return text
    .split(SENTENCE_BREAK)
    .filter(
      (sentence) =>
        sentence.trim() !== "" &&
        hasOnlyGroundedNumbers(sentence, evidence) &&
        hasOnlyGroundedNames(sentence, evidence.quotedTexts),
    )
    .join(" ");
}

/**
 * insight 숫자는 insightKey 항목과 전체 통계에서만 온다. 다른 항목의 숫자("운동은 12개 중 11개"에
 * 업무 수치)를 붙인 문장과 데이터에 없는 이름을 감싼 문장은 뺀다. 모르는 key나 null이면 전체 통계로만 본다.
 */
export function keepGroundedInsight(
  insight: string,
  insightKey: string | null,
  evidence: ReportEvidence,
): string {
  const item = evidence.items.find(({ key }) => key === insightKey);
  return keepGroundedSentences(insight, {
    numbers: [...evidence.overallNumbers, ...(item?.numbers ?? [])],
    quotedTexts: evidence.quotedTexts,
  });
}

/** tip은 숫자를 쓰지 않고 근거 이름만 감싼다. 사용자가 쓴 이름 속 분량("PT 3회권")만 허용한다. */
export function isGroundedTip(tip: string, quotedTexts: readonly string[]): boolean {
  return (
    hasOnlyGroundedNumbers(tip, { numbers: [], quotedTexts }) &&
    hasOnlyGroundedNames(tip, quotedTexts)
  );
}
