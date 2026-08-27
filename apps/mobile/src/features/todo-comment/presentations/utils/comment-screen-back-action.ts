import type { CommentRouteMode } from './comment-route-state';

export type CommentScreenBackAction = 'native' | 'consume' | 'close-composer' | 'clear-thread';

interface CommentScreenBackState {
  mode: CommentRouteMode;
  isSubmitting: boolean;
}

export function getCommentScreenBackAction({
  mode,
  isSubmitting,
}: CommentScreenBackState): CommentScreenBackAction {
  if (isSubmitting) {
    return 'consume';
  }

  if (mode === 'thread') {
    return 'clear-thread';
  }

  if (mode === 'reply' || mode === 'edit' || mode === 'create') {
    return 'close-composer';
  }

  return 'native';
}
