export interface CommentFormChainFieldLayout {
  isConnectedToNext: boolean;
  shouldShowRemoveAction: boolean;
  shouldShowSubmissionActions: boolean;
}

export function getCommentFormChainFieldLayout(
  fieldIndex: number,
  fieldCount: number,
): CommentFormChainFieldLayout {
  return {
    isConnectedToNext: fieldIndex < fieldCount - 1,
    shouldShowRemoveAction: fieldIndex > 0,
    shouldShowSubmissionActions: fieldIndex === fieldCount - 1,
  };
}
