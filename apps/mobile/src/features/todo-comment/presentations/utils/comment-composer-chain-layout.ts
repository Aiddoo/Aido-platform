export interface CommentComposerChainFieldLayout {
  connectsToNext: boolean;
  showsRemoveAction: boolean;
  showsSubmissionActions: boolean;
}

export function getCommentComposerChainFieldLayout(
  fieldIndex: number,
  fieldCount: number,
): CommentComposerChainFieldLayout {
  return {
    connectsToNext: fieldIndex < fieldCount - 1,
    showsRemoveAction: fieldIndex > 0,
    showsSubmissionActions: fieldIndex === fieldCount - 1,
  };
}
