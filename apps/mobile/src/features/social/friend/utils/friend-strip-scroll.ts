interface FriendStripRevealInput {
  /** 스크롤 콘텐츠 기준 항목 시작 위치 */
  itemStart: number;
  itemWidth: number;
  scrollOffset: number;
  viewportWidth: number;
  /** 가장자리에 남겨 친구가 더 있다는 걸 보여 줄 폭 */
  edgePeek: number;
}

/** 선택한 친구가 줄에 다 보이면 null, 잘렸으면 가장자리 여유만 남기고 옮긴 스크롤 위치를 돌려준다. 맨 앞은 0 아래로 넘기지 않는다 */
export function getFriendStripRevealOffset({
  itemStart,
  itemWidth,
  scrollOffset,
  viewportWidth,
  edgePeek,
}: FriendStripRevealInput): number | null {
  const itemEnd = itemStart + itemWidth;

  if (itemStart < scrollOffset + edgePeek) {
    const offset = Math.max(0, itemStart - edgePeek);
    return offset === scrollOffset ? null : offset;
  }
  if (itemEnd > scrollOffset + viewportWidth - edgePeek) {
    return itemEnd + edgePeek - viewportWidth;
  }
  return null;
}
