let nextOptimisticId = -1;

/** 서버 id와 겹치지 않는 음의 정수 id */
export function createOptimisticId(): number {
  return nextOptimisticId--;
}
