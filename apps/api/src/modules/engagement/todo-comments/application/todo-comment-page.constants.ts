/** cursor가 가리키는 기준 행에서 어느 쪽으로 읽는지. 출시 앱 cursor에 담긴 값이라 바꾸지 않는다 */
export const TODO_COMMENT_PAGE_DIRECTIONS = ["BEFORE", "AFTER"] as const;
export type TodoCommentPageDirection = (typeof TODO_COMMENT_PAGE_DIRECTIONS)[number];

/** v1 대화 cursor가 할 일 전체를 넘기는지, focus로 연 한 묶음 안에서만 넘기는지 */
export const TODO_CONVERSATION_SCOPES = ["TODO", "THREAD"] as const;
export type TodoConversationScope = (typeof TODO_CONVERSATION_SCOPES)[number];

/** 기준 행 앞뒤를 함께 읽는 창. 묶음은 anchor, 답글은 around, 대화는 focus로 연다 */
const TODO_COMMENT_THREAD_PAGE_MODES = ["INITIAL", "BEFORE", "AFTER", "ANCHOR"] as const;
export type TodoCommentThreadPageMode = (typeof TODO_COMMENT_THREAD_PAGE_MODES)[number];

const TODO_COMMENT_REPLY_PAGE_MODES = ["INITIAL", "BEFORE", "AFTER", "AROUND"] as const;
export type TodoCommentReplyPageMode = (typeof TODO_COMMENT_REPLY_PAGE_MODES)[number];

const TODO_CONVERSATION_PAGE_MODES = ["INITIAL", "BEFORE", "AFTER", "FOCUS"] as const;
export type TodoConversationPageMode = (typeof TODO_CONVERSATION_PAGE_MODES)[number];
