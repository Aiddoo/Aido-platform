let nextOptimisticId = -1;

/** 서버 id와 겹치지 않는 음의 정수 id. 응답 후 목록을 다시 불러오면 사라진다. */
export function createOptimisticId(): number {
  return nextOptimisticId--;
}
