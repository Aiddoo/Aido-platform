// 공백만 남은 선택 칸은 보내지 않아 서버가 값 없이 받는다
export function toOptionalText(text: string | undefined): string | undefined {
  const trimmed = text?.trim();

  return trimmed == null || trimmed.length === 0 ? undefined : trimmed;
}
