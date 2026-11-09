/** URL에서 경로만 꺼낸다. 파싱할 수 없으면 받은 값을 그대로 돌려준다 */
export function getPathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
