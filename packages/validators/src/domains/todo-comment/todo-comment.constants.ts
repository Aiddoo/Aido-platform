/** 스레드 깊이에는 상한이 없다. 대화 조회는 평탄한 커서 페이지로 크기를 제한한다. */
export const TODO_COMMENT_LIMITS = {
  CONTENT_MAX_LENGTH: 500,
  DEFAULT_PAGE_SIZE: 30,
  MAX_PAGE_SIZE: 50,
  /** 한 번에 이어 쓸 수 있는 글 수 — 각 글이 앞 글의 답글이 되는 사슬의 최대 길이 */
  CHAIN_MAX_SIZE: 5,
  /** focus 응답에 별도로 실을 수 있는 조상 수 */
  FOCUS_ANCESTOR_MAX_SIZE: 20,
  /** 개요에서 중복 없이 미리 보여 줄 참여 작성자 수 */
  OVERVIEW_PARTICIPANT_MAX_SIZE: 3,
} as const;

export const TODO_COMMENT_SORT = {
  POPULAR: 'POPULAR',
  LATEST: 'LATEST',
} as const;

export type TodoCommentSort = (typeof TODO_COMMENT_SORT)[keyof typeof TODO_COMMENT_SORT];
