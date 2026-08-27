export interface TodoCommentEventMap {
  /** depth 0이 할 일에 바로 달린 댓글 — 대화가 얼마나 깊어지는지 본다. */
  todo_comment_created: { todo_id: number; depth: number };
  todo_comment_deleted: { todo_id: number; depth: number };
  todo_comment_liked: { todo_id: number; is_liked: boolean };
  todo_comment_sorted: { todo_id: number; sort: 'POPULAR' | 'LATEST' };
}
