interface CommentRowIdentity {
  comment: { id: string; threadId?: string };
}

interface CommentRowLayout {
  y: number;
  height: number;
}

const FOCUSED_COMMENT_VIEW_POSITION = 0.18;
const FOCUSED_COMMENT_CLEARANCE = 12;
const KEYBOARD_LIFT_RISK_POSITION = 0.55;

export type CommentKeyboardLiftBehavior = 'never' | 'persistent' | 'whenAtEnd';

interface ConversationPageParam {
  direction: string;
}

interface ConversationWindow<TPage, TPageParam extends ConversationPageParam> {
  pages: TPage[];
  pageParams: TPageParam[];
}

export function getInitialCommentIndex(
  rows: readonly CommentRowIdentity[],
  focusedCommentId: string | null,
): number | undefined {
  if (focusedCommentId === null) {
    return undefined;
  }

  const index = rows.findIndex((row) => row.comment.id === focusedCommentId);
  return index >= 0 ? index : undefined;
}

export function getConversationThreadId(
  rows: readonly CommentRowIdentity[],
  focusedCommentId: string | null,
): string | null {
  const focusedThreadId = rows.find((row) => row.comment.id === focusedCommentId)?.comment.threadId;
  return focusedThreadId ?? rows[0]?.comment.threadId ?? null;
}

export function getUnloadedCommentFocusOffset({
  itemLayout,
  firstItemOffset,
  viewportHeight,
}: {
  itemLayout: CommentRowLayout;
  firstItemOffset: number;
  viewportHeight: number;
}): number {
  const availableSpace = Math.max(viewportHeight - itemLayout.height, 0);
  const positionedOffset =
    firstItemOffset + itemLayout.y - availableSpace * FOCUSED_COMMENT_VIEW_POSITION;

  return Math.max(positionedOffset, 0);
}

export function getFocusedCommentKeyboardLiftBehavior({
  itemLayout,
  firstItemOffset,
  scrollOffset,
  viewportHeight,
}: {
  itemLayout: CommentRowLayout;
  firstItemOffset: number;
  scrollOffset: number;
  viewportHeight: number;
}): CommentKeyboardLiftBehavior {
  if (viewportHeight <= 0) {
    return 'whenAtEnd';
  }

  const itemBottomInViewport = firstItemOffset + itemLayout.y + itemLayout.height - scrollOffset;
  const itemTopInViewport = itemBottomInViewport - itemLayout.height;

  if (itemBottomInViewport <= 0 || itemTopInViewport >= viewportHeight) {
    return 'whenAtEnd';
  }

  return itemBottomInViewport >= viewportHeight * KEYBOARD_LIFT_RISK_POSITION
    ? 'persistent'
    : 'whenAtEnd';
}

export function getCommentFocusRevealOffset({
  itemLayout,
  firstItemOffset,
  scrollOffset,
  viewportHeight,
  bottomInset,
}: {
  itemLayout: CommentRowLayout;
  firstItemOffset: number;
  scrollOffset: number;
  viewportHeight: number;
  bottomInset: number;
}): number | null {
  if (viewportHeight <= 0 || bottomInset < 0) {
    return null;
  }

  const itemBottomInViewport = firstItemOffset + itemLayout.y + itemLayout.height - scrollOffset;
  const itemTopInViewport = itemBottomInViewport - itemLayout.height;
  if (itemBottomInViewport <= 0 || itemTopInViewport >= viewportHeight) {
    return null;
  }

  if (itemTopInViewport < FOCUSED_COMMENT_CLEARANCE) {
    return Math.max(scrollOffset + itemTopInViewport - FOCUSED_COMMENT_CLEARANCE, 0);
  }

  const safeBottom = Math.max(
    viewportHeight - bottomInset - FOCUSED_COMMENT_CLEARANCE,
    FOCUSED_COMMENT_CLEARANCE,
  );
  const obscuredHeight = itemBottomInViewport - safeBottom;
  if (obscuredHeight <= 0) {
    return null;
  }

  return Math.max(scrollOffset + obscuredHeight, 0);
}

export function canFetchPreviousComments(
  focusIdentity: string | null,
  revealedFocusIdentity: string | null,
): boolean {
  return focusIdentity === null || focusIdentity === revealedFocusIdentity;
}

export function toInitialConversationWindow<TPage, TPageParam extends ConversationPageParam>(
  data: ConversationWindow<TPage, TPageParam>,
): ConversationWindow<TPage, TPageParam> | null {
  const initialIndex = data.pageParams.findIndex(({ direction }) => direction === 'initial');
  const initialPage = data.pages[initialIndex];
  const initialPageParam = data.pageParams[initialIndex];

  if (initialPage === undefined || initialPageParam === undefined) {
    return null;
  }

  if (initialIndex === 0 && data.pages.length === 1) {
    return data;
  }

  return { pages: [initialPage], pageParams: [initialPageParam] };
}
