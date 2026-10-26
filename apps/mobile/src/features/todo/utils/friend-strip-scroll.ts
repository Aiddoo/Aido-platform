interface FriendStripRevealInput {
  /** 스크롤 콘텐츠 기준 항목 시작 위치 */
  itemStart: number;
  itemWidth: number;
  /** 지금 스크롤 위치 */
  scrollOffset: number;
  viewportWidth: number;
  /** 가장자리에 남겨 친구가 더 있다는 걸 보여 줄 폭 */
  edgePeek: number;
}

/**
 * 선택한 친구가 친구 줄에 다 보이면 움직이지 않고(null), 잘렸으면 잘린 쪽 가장자리에 여유를 남기는
 * 만큼만 옮긴 스크롤 위치를 돌려준다. 맨 앞 친구는 콘텐츠 시작(0)보다 앞으로 넘기지 않는다.
 * 맨 끝 친구 뒤에는 늘 친구 추가·불러오기 칸이 있어 오른쪽 여유가 콘텐츠를 넘지 않는다.
 */
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
