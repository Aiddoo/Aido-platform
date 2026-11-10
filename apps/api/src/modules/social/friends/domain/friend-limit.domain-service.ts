// 친구 요청과 초대의 바로 친구 맺기가 같은 한도 규칙을 쓴다. 한도가 null이면 무제한이다
export function hasReachedFriendLimit(params: {
  readonly maxFriendCount: number | null;
  readonly friendCount: number;
}): boolean {
  return params.maxFriendCount != null && params.friendCount >= params.maxFriendCount;
}
