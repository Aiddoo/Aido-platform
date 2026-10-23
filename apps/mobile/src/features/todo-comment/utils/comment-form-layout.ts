const COMMENT_FORM_VIEWPORT_RATIO = 0.4;
const COMMENT_FORM_MIN_HEIGHT = 176;
const COMMENT_FORM_MAX_HEIGHT = 320;

export function getCommentFormMaxHeight(viewportHeight: number): number {
  return Math.max(
    COMMENT_FORM_MIN_HEIGHT,
    Math.min(COMMENT_FORM_MAX_HEIGHT, Math.floor(viewportHeight * COMMENT_FORM_VIEWPORT_RATIO)),
  );
}
