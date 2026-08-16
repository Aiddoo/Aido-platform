/** 답글을 읽으러 들어온 경로 — 맛보기를 눌렀는지, 더 보기를 눌렀는지 본다. */
export type CommentThreadEntry = 'reply_preview' | 'more_replies';

export interface TodoCommentEventMap {
  /** depth 0이 할 일에 바로 달린 댓글 — 대화가 얼마나 깊어지는지 본다. */
  todo_comment_created: { todo_id: number; depth: number };
  todo_comment_deleted: { todo_id: number; depth: number };
  todo_comment_liked: { todo_id: number; is_liked: boolean };
  todo_comment_sorted: { todo_id: number; sort: 'POPULAR' | 'LATEST' };
  comment_thread_opened: { todo_id: number; entry: CommentThreadEntry; depth: number };
}
