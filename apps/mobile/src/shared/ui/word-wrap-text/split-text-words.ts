export interface TextRun {
  text: string;
  isUnderlined?: boolean;
  testID?: string;
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
