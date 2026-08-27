const COMMENT_COMPOSER_VIEWPORT_RATIO = 0.4;
const COMMENT_COMPOSER_MIN_HEIGHT = 176;
const COMMENT_COMPOSER_MAX_HEIGHT = 320;

export function getCommentComposerMaxHeight(viewportHeight: number): number {
  return Math.max(
    COMMENT_COMPOSER_MIN_HEIGHT,
    Math.min(
      COMMENT_COMPOSER_MAX_HEIGHT,
      Math.floor(viewportHeight * COMMENT_COMPOSER_VIEWPORT_RATIO),
    ),
  );
}
