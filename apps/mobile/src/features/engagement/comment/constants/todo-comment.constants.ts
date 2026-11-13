import { TODO_COMMENT_LIMITS } from '@aido/api/vocabulary';
import { MINUTE_MS, SECOND_MS } from '@src/shared/constants/time-units';

export const TODO_COMMENT_PAGE_SIZE = {
  THREADS: TODO_COMMENT_LIMITS.DEFAULT_PAGE_SIZE,
  REPLIES: TODO_COMMENT_LIMITS.REPLY_PAGE_DEFAULT_SIZE,
} as const;

export const TODO_COMMENT_QUERY_TIMING = {
  latestStaleTimeMs: 30 * SECOND_MS,
  popularStaleTimeMs: 10 * SECOND_MS,
  gcTimeMs: 30 * MINUTE_MS,
} as const;

export const TODO_COMMENT_HIGHLIGHT_DURATION_MS = 1_600;

export const TODO_COMMENT_INPUT_NATIVE_ID = 'todo-comment-input';
