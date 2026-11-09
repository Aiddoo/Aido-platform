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
  const pieces = runs.flatMap((run) =>
    run.text.split(/(\s+)/).map((piece): TextRun => ({ ...run, text: piece })),
  );
  const groups = pieces.reduce<TextRun[][]>(
    (words, piece) => {
      if (/^\s+$/.test(piece.text)) {
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
