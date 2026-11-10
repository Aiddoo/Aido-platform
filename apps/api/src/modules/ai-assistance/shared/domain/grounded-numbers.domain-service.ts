/** 정수와 소수("8.3"). 날짜·시각은 구분자에서 끊겨 각각의 수가 된다. */
const NUMBER = /\d+(?:\.\d+)?/g;
/** 숫자와 바로 뒤의 단위("30개", "5km", "5 km", "43주차") */
const QUANTITY = /\d+(?:\.\d+)?(?:[ \t]?[^\s\d.,!?()]+)?/g;

export function numbersIn(text: string): number[] {
  return (text.match(NUMBER) ?? []).map(Number);
}

export interface NumberEvidence {
  /** 서버가 계산해 모델에 준 수치 */
  readonly numbers: Iterable<number>;
  /** 사용자가 직접 쓴 문자열(제목·카테고리 이름 등). 그 안의 분량을 그대로 다시 쓴 것은 근거로 본다. */
  readonly quotedTexts: readonly string[];
}

/** 인용한 문자열의 분량을 지운다. 같은 숫자라도 단위가 다르면("10분" → "10주") 남긴다. */
function withoutQuotedQuantities(text: string, quotedTexts: readonly string[]): string {
  const quantities = quotedTexts.flatMap((quoted) => quoted.toLowerCase().match(QUANTITY) ?? []);
  return quantities.reduce(
    (remaining, quantity) => remaining.split(quantity).join(" "),
    text.toLowerCase(),
  );
}

/** 모델 문장의 숫자가 모두 근거에 있는지 본다. 근거 밖 수치는 환각으로 본다. */
export function hasOnlyGroundedNumbers(text: string, evidence: NumberEvidence): boolean {
  const allowed = new Set(evidence.numbers);
  return numbersIn(withoutQuotedQuantities(text, evidence.quotedTexts)).every((value) =>
    allowed.has(value),
  );
}
