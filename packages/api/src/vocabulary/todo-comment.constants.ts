/** 스레드 깊이에는 상한이 없다. 대화 조회는 평탄한 커서 페이지로 크기를 제한한다. */
export const TODO_COMMENT_LIMITS = {
  CONTENT_MAX_LENGTH: 500,
  DEFAULT_PAGE_SIZE: 30,
  MAX_PAGE_SIZE: 50,
  /** 답글 묶음 하나를 펼칠 때 한 번에 읽는 답글 수 */
  REPLY_PAGE_DEFAULT_SIZE: 10,
  /** 한 번에 이어 쓸 수 있는 글 수. 이어 쓴 글은 같은 묶음에 차례로 붙고 각자 앞 글에 답한다 */
  CHAIN_MAX_SIZE: 5,
  /** v1 대화 focus 응답에 따로 싣는 앞 문맥 수. 2단계라 실제로는 묶음 머리 하나뿐이다 */
  FOCUS_ANCESTOR_MAX_SIZE: 20,
  /** 묶음마다 미리 보여 줄 중복 없는 답글 작성자 수 */
  OVERVIEW_PARTICIPANT_MAX_SIZE: 3,
} as const;

export const TODO_COMMENT_SORT = {
  POPULAR: "POPULAR",
  LATEST: "LATEST",
} as const;

export type TodoCommentSort = (typeof TODO_COMMENT_SORT)[keyof typeof TODO_COMMENT_SORT];

/** 댓글은 할 일에 바로 단 글(묶음 머리), 답글은 그 묶음에 붙은 글이다 */
export const TODO_COMMENT_KIND = {
  COMMENT: "COMMENT",
  REPLY: "REPLY",
} as const;

export type TodoCommentKind = (typeof TODO_COMMENT_KIND)[keyof typeof TODO_COMMENT_KIND];
