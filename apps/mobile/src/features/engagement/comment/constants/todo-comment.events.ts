declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    /** 댓글·답글 2단계. chain_size는 한 번에 이어 쓴 글 수다. */
    todo_comment_created: { todo_id: number; is_reply: boolean; chain_size: number };
    todo_comment_deleted: { todo_id: number; is_reply: boolean };
    todo_comment_liked: { todo_id: number; is_liked: boolean; via: 'button' | 'double_tap' };
    todo_comment_sorted: { todo_id: number; sort: 'POPULAR' | 'LATEST' };
    /** 묶음을 펼치거나 더 볼 때. loaded_count는 펼친 뒤 보이는 답글 수다. */
    todo_comment_replies_expanded: { todo_id: number; loaded_count: number };
    todo_comment_reply_started: { todo_id: number; target: 'comment' | 'reply' };
    todo_comment_hint_dismissed: { kind: 'double_tap'; reason: 'close' | 'used' };
  }
}

export {};
