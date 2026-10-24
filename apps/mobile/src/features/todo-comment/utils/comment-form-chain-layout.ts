export interface CommentFormChainFieldLayout {
  isConnectedToNext: boolean;
  showsRemoveAction: boolean;
  showsSubmissionActions: boolean;
}

export function getCommentFormChainFieldLayout(
  fieldIndex: number,
  fieldCount: number,
): CommentFormChainFieldLayout {
  return {
    isConnectedToNext: fieldIndex < fieldCount - 1,
    showsRemoveAction: fieldIndex > 0,
    showsSubmissionActions: fieldIndex === fieldCount - 1,
  };
}
