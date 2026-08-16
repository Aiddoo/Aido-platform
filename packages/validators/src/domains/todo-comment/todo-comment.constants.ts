/**
 * 스레드 깊이에는 상한이 없다 — 답글의 답글이 얼마든 이어진다.
 * 대신 목록 응답이 깊이에 따라 커지지 않도록, 어떤 목록이든 자식 미리보기를 한 겹만 싣는다.
 */
export const TODO_COMMENT_LIMITS = {
  CONTENT_MAX_LENGTH: 500,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 50,
  /** 한 댓글에 함께 보여줄 답글 수 */
  REPLY_PREVIEW_SIZE: 2,
  /** 한 번에 이어 쓸 수 있는 글 수 — 각 글이 앞 글의 답글이 되는 사슬의 최대 길이 */
  CHAIN_MAX_SIZE: 5,
} as const;

export const TODO_COMMENT_SORT = {
  POPULAR: 'POPULAR',
  LATEST: 'LATEST',
} as const;

export type TodoCommentSort = (typeof TODO_COMMENT_SORT)[keyof typeof TODO_COMMENT_SORT];
