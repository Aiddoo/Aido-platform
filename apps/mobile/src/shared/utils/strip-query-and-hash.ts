/** URL·경로에서 첫 `?`·`#`부터 뒤를 지운다. `URL`은 상대 경로를 읽지 못하고 경로를 정규화해 쓰지 않는다 */
export function stripQueryAndHash(url: string): string {
  return url.split(/[?#]/, 1)[0] ?? '';
}
