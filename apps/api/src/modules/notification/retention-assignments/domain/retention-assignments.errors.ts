// 후보로 읽은 단계가 배정에 없으면 조회와 배정이 어긋난 것이다
export function retentionStageMissing(stageId: string): Error {
  return new Error(`Retention stage ${stageId} is not part of the assignment`);
}
