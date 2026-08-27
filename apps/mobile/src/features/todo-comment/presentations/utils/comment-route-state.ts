import { TODO_COMMENT_SORT, todoCommentIdSchema, type TodoCommentSort } from '@aido/validators';
import { z } from 'zod';

const commentSortSchema = z
  .enum(TODO_COMMENT_SORT)
  .default(TODO_COMMENT_SORT.LATEST)
  .catch(TODO_COMMENT_SORT.LATEST);
const commentIntentSchema = z.enum(['thread', 'reply', 'edit', 'create']);
const rawCommentRouteStateSchema = z
  .object({
    sort: z.unknown().optional(),
    comment: z.unknown().optional(),
    intent: z.unknown().optional(),
  })
  .catch({});

export type CommentRouteMode = 'overview' | z.infer<typeof commentIntentSchema>;

export type CommentRouteState =
  | {
      sort: TodoCommentSort;
      mode: 'overview' | 'create';
      anchorCommentId: undefined;
    }
  | {
      sort: TodoCommentSort;
      mode: 'thread' | 'reply' | 'edit';
      anchorCommentId: string;
    };

function toOverview(sort: TodoCommentSort): CommentRouteState {
  return { sort, mode: 'overview', anchorCommentId: undefined };
}

export function parseCommentRouteState(params: unknown): CommentRouteState {
  const raw = rawCommentRouteStateSchema.parse(params);
  const sort = commentSortSchema.parse(raw.sort);
  const hasComment = raw.comment !== undefined;
  const hasIntent = raw.intent !== undefined;

  if (!hasComment && !hasIntent) {
    return toOverview(sort);
  }

  const parsedComment = todoCommentIdSchema.safeParse(raw.comment);
  const parsedIntent = commentIntentSchema.safeParse(raw.intent);

  if (hasComment && !parsedComment.success) {
    return toOverview(sort);
  }

  if (hasIntent && !parsedIntent.success) {
    return toOverview(sort);
  }

  if (parsedComment.success && !hasIntent) {
    return { sort, mode: 'thread', anchorCommentId: parsedComment.data };
  }

  if (!hasComment && parsedIntent.success && parsedIntent.data === 'create') {
    return { sort, mode: 'create', anchorCommentId: undefined };
  }

  if (parsedComment.success && parsedIntent.success && parsedIntent.data !== 'create') {
    return {
      sort,
      mode: parsedIntent.data,
      anchorCommentId: parsedComment.data,
    };
  }

  return toOverview(sort);
}
