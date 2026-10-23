export interface CommentFormChainFieldLayout {
  connectsToNext: boolean;
  showsRemoveAction: boolean;
  showsSubmissionActions: boolean;
}

export function getCommentFormChainFieldLayout(
  fieldIndex: number,
  fieldCount: number,
): CommentFormChainFieldLayout {
  return {
    connectsToNext: fieldIndex < fieldCount - 1,
    showsRemoveAction: fieldIndex > 0,
    showsSubmissionActions: fieldIndex === fieldCount - 1,
  };
}
