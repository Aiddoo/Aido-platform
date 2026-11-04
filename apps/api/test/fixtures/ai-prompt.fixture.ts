/** wrapUntrusted로 만든 블록의 값을 되읽는다. 없으면 실패한다. */
export function readPromptBlock(prompt: string, tag: string) {
  const json = new RegExp(`<${tag}>\\n([\\s\\S]*?)\\n</${tag}>`).exec(prompt)?.[1];
  if (json == null) {
    throw new Error(`${tag} block missing`);
  }
  return JSON.parse(json);
}

/** system 최상위 블록 이름을 순서대로 */
export function topLevelTags(system: string): string[] {
  return [...system.matchAll(/^<([a-z_]+)>$/gm)].map((match) => match[1] ?? "");
}

/** examples 블록의 출력 JSON들 */
export function exampleOutputs(system: string): unknown[] {
  return [...system.matchAll(/^(?:출력|Output): (\{.+\})$/gm)].map((match) =>
    JSON.parse(match[1] ?? ""),
  );
}
