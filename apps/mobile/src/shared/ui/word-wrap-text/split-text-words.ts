export interface TextRun {
  text: string;
  isUnderlined?: boolean;
  testID?: string;
}

/** 빈칸으로 단어를 나눈다. 한 단어 안에서 모양이 달라지는 조각(밑줄)은 같은 단어로 묶는다 */
export function splitRunsIntoWords(runs: readonly TextRun[]): TextRun[][] {
  const words: TextRun[][] = [];
  let current: TextRun[] = [];

  for (const run of runs) {
    for (const piece of run.text.split(/(\s+)/)) {
      if (/^\s+$/.test(piece)) {
        if (current.length > 0) {
          words.push(current);
          current = [];
        }
      } else if (piece !== '') {
        current.push({ ...run, text: piece });
      }
    }
  }
  if (current.length > 0) {
    words.push(current);
  }

  return words;
}

export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter((word) => word.length > 0);
}
