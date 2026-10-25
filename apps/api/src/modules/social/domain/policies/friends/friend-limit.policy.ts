/**
 * 친구 요청과 초대의 바로 친구 맺기가 같은 한도 규칙을 쓴다. 한도가 없으면(null) 무제한이고,
 * 이미 한도만큼 친구가 있으면 더 맺을 수 없다.
 */
export function hasReachedFriendLimit(maxCount: number | null, friendCount: number): boolean {
  return maxCount != null && friendCount >= maxCount;
}
