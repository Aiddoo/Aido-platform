export interface TextRun {
  text: string;
  isUnderlined?: boolean;
  testID?: string;
}

/** 줄바꿈 위치에서만 나눈다. 줄바꿈이 없는 run은 앞뒤 run과 같은 줄에 남는다 */
export function splitRunsIntoLines(runs: readonly TextRun[]): TextRun[][] {
  const lines: TextRun[][] = [[]];

  for (const run of runs) {
    run.text.split('\n').forEach((text, index) => {
      if (index > 0) {
        lines.push([]);
      }
      lines.at(-1)?.push({ ...run, text });
    });
  }

  return lines;
}

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
