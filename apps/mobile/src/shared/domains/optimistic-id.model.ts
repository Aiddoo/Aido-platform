/** 서버 응답 전의 임시 행. `createOptimisticId`가 음수 id를 주고 서버 id는 양수다. 임시 id로는 요청을 보낼 수 없다 */
export function isOptimisticId(id: number): boolean {
  return id < 0;
}
