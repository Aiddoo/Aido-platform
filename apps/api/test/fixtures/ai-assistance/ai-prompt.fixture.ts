/** wrapUntrusted로 만든 블록의 값을 되읽는다. 없으면 실패한다. */
export function readPromptBlock(prompt: string, tag: string) {
  const json = new RegExp(`<${tag}>\\n([\\s\\S]*?)\\n</${tag}>`).exec(prompt)?.[1];
  if (json == null) {
    throw new Error(`${tag} block missing`);
  }
  return JSON.parse(json);
}

export function topLevelTags(system: string): string[] {
  return [...system.matchAll(/^<([a-z_]+)>$/gm)].map((match) => match[1] ?? "");
}

export function exampleOutputs(system: string): unknown[] {
  return [...system.matchAll(/^(?:출력: |Output: |<output>)(\{.+\})(?:<\/output>)?$/gm)].map(
    (match) => JSON.parse(match[1] ?? ""),
  );
}

export function readExamples(system: string, tag: string) {
  return [...system.matchAll(/^<example>\n([\s\S]*?)\n<\/example>$/gm)].map((match) => {
    const body = match[1] ?? "";
    const [output] = exampleOutputs(body);
    if (output == null) {
      throw new Error("example output missing");
    }
    return { input: readPromptBlock(body, tag), output };
  });
}
