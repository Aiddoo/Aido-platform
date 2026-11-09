export type FriendSearchLengthBucket = '2_3' | '4_7' | '8_plus';

export function toFriendSearchLengthBucket(query: string): FriendSearchLengthBucket {
  const length = [...query.trim()].length;
  if (length <= 3) {
    return '2_3';
  }
  if (length <= 7) {
    return '4_7';
  }
  return '8_plus';
}
