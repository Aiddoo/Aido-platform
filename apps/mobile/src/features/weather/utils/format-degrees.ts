/** 영하는 하이픈 대신 마이너스 기호(−)로 써서 숫자 폭과 읽기를 맞춘다. */
export function formatDegrees(value: number): string {
  return `${value < 0 ? '−' : ''}${Math.abs(value)}°`;
}
