export interface TextRun {
  text: string;
  isUnderlined?: boolean;
  testID?: string;
}

/** 줄바꿈 위치에서만 나눈다. 줄바꿈이 없는 run은 앞뒤 run과 같은 줄에 남는다 */
export function splitRunsIntoLines(runs: readonly TextRun[]): TextRun[][] {
  const lines: TextRun[][] = [[]];

  for (const run of runs) {
    for (const [index, text] of run.text.split('\n').entries()) {
      if (index > 0) {
        lines.push([]);
      }
      lines.at(-1)?.push({ ...run, text });
    }
  }

  return lines;
}

// 줄바꿈 없는 공백(U+00A0)은 빈칸이 아니라 단어 안 글자로 본다. 날짜("12월 23일")가 두 줄로 갈라지지 않는다
const WORD_SEPARATOR = /([^\S\u00A0]+)/;
const WORD_SEPARATOR_ONLY = /^[^\S\u00A0]+$/;

export function splitRunsIntoWords(runs: readonly TextRun[]): TextRun[][] {
  const pieces = runs.flatMap((run) =>
    run.text.split(WORD_SEPARATOR).map((piece): TextRun => ({ ...run, text: piece })),
  );
  const groups = pieces.reduce<TextRun[][]>(
    (words, piece) => {
      if (WORD_SEPARATOR_ONLY.test(piece.text)) {
        return [...words, []];
      }
      if (piece.text === '') {
        return words;
      }
      return [...words.slice(0, -1), [...(words.at(-1) ?? []), piece]];
    },
    [[]],
  );

  return groups.filter((word) => word.length > 0);
}

export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter((word) => word.length > 0);
}
