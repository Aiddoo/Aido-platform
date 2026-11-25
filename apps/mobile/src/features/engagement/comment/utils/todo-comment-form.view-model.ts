/** 이어 쓰던 칸 하나를 지운 뒤 입력을 이어 갈 칸. 지운 칸에 있었으면 바로 앞 칸이다 */
export function getFocusedCommentFieldIndexAfterRemoval(
  focusedIndex: number,
  removedIndex: number,
): number {
  if (focusedIndex < removedIndex) {
    return focusedIndex;
  }

  if (focusedIndex > removedIndex) {
    return focusedIndex - 1;
  }

  return Math.max(0, removedIndex - 1);
}
