import { clamp } from 'es-toolkit';

const COMMENT_FORM_VIEWPORT_RATIO = 0.4;
const COMMENT_FORM_MIN_HEIGHT = 176;
const COMMENT_FORM_MAX_HEIGHT = 320;

export function getCommentFormMaxHeight(viewportHeight: number): number {
  return clamp(
    Math.floor(viewportHeight * COMMENT_FORM_VIEWPORT_RATIO),
    COMMENT_FORM_MIN_HEIGHT,
    COMMENT_FORM_MAX_HEIGHT,
  );
}
