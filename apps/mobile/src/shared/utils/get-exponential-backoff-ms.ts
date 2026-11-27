const BACKOFF_FACTOR = 2;

interface ExponentialBackoff {
  baseMs: number;
  /** 없으면 상한 없이 두 배씩 는다 */
  maxMs?: number;
  /** 주면 full jitter: 0과 그 시도의 상한 사이에서 고른다. 난수를 인자로 받아 테스트가 정한다 */
  random?: () => number;
}

/** 시도 0은 `baseMs`이고 시도마다 두 배가 되며 `maxMs`를 넘지 않는다 */
export function getExponentialBackoffMs(
  attempt: number,
  { baseMs, maxMs = Number.POSITIVE_INFINITY, random }: ExponentialBackoff,
): number {
  const ceilingMs = Math.min(baseMs * BACKOFF_FACTOR ** attempt, maxMs);
  return random == null ? ceilingMs : Math.floor(random() * ceilingMs);
}
