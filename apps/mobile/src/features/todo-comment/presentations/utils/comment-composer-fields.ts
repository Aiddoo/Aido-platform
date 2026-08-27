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
