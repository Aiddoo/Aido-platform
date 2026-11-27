import type { FlashListRef } from '@shopify/flash-list';
import { createEventChannel } from '@src/core/events/event-channel';
import {
  type ComponentRef,
  createContext,
  type PropsWithChildren,
  type RefObject,
  use,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { View } from 'react-native';
import { KeyboardController, KeyboardEvents } from 'react-native-keyboard-controller';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';

import { TODO_COMMENT_HIGHLIGHT_DURATION_MS } from '../constants/todo-comment.constants';
import type { TodoCommentThread } from '../domains/todo-comment-thread.model';

const REVEAL_MARGIN = 16;

// 강조를 목록 상태로 두면 켜지고 꺼질 때 보이는 행이 모두 다시 그려진다. 행마다 자기 댓글이 강조됐는지만 구독한다
function createHighlightedCommentStore() {
  let commentId: string | null = null;
  const changed = createEventChannel('todo-comment-highlight');

  return {
    get: () => commentId,
    set: (nextCommentId: string | null) => {
      if (nextCommentId === commentId) {
        return;
      }
      commentId = nextCommentId;
      changed.emit();
    },
    subscribe: (listener: () => void) => changed.subscribe(listener),
  };
}

interface TodoCommentRevealValue {
  listRef: RefObject<FlashListRef<TodoCommentThread> | null>;
  composerRef: RefObject<ComponentRef<typeof View> | null>;
  /** 키보드가 열린 채 작성기가 커지면 목록 끝을 그만큼 더 올린다 */
  extraContentPadding: SharedValue<number>;
  reveal: (target: RefObject<ComponentRef<typeof View> | null>) => void;
  /** 키보드와 무관하게 행이 작성 바에 가려 있으면 그만큼 올린다(알림으로 연 답글) */
  showAboveComposer: (target: RefObject<ComponentRef<typeof View> | null>) => void;
  /** 알림·링크로 연 댓글을 잠깐 강조한다. 행이 재활용되어 다시 그려져도 되풀이되지 않게 행보다 오래 사는 세션이 켜고 끈다 */
  highlight: (commentId: string) => void;
  clearHighlight: () => void;
  highlightedComment: ReturnType<typeof createHighlightedCommentStore>;
}

const TodoCommentRevealContext = createContext<TodoCommentRevealValue | null>(null);

/** 키보드가 다 올라온 뒤 실제 화면 위치로 재므로 글자 크기·행 높이와 무관하다 */
export function TodoCommentRevealProvider({ children }: PropsWithChildren) {
  const listRef = useRef<FlashListRef<TodoCommentThread>>(null);
  const composerRef = useRef<ComponentRef<typeof View>>(null);
  const extraContentPadding = useSharedValue(0);
  const pendingRef = useRef<{ remove: () => void } | null>(null);
  const frameRef = useRef<number | null>(null);
  const [highlightedComment] = useState(createHighlightedCommentStore);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPending = () => cancelPendingReveal(pendingRef, frameRef);

  const scrollAboveComposer = (target: RefObject<ComponentRef<typeof View> | null>) => {
    target.current?.measureInWindow((_x, rowTop, _width, rowHeight) => {
      composerRef.current?.measureInWindow((_composerX, composerTop) => {
        const overlap = rowTop + rowHeight + REVEAL_MARGIN - composerTop;
        const list = listRef.current;
        if (overlap <= 0 || list == null) {
          return;
        }
        list.scrollToOffset({
          offset: list.getAbsoluteLastScrollOffset() + overlap,
          animated: true,
        });
      });
    });
  };

  const reveal = (target: RefObject<ComponentRef<typeof View> | null>) => {
    clearPending();
    if (KeyboardController.isVisible()) {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        scrollAboveComposer(target);
      });

      return;
    }
    // 키보드가 다 오른 뒤 작성 바(대상 안내 줄 포함)의 레이아웃이 끝난 다음 frame에 잰다
    pendingRef.current = KeyboardEvents.addListener('keyboardDidShow', () => {
      clearPending();
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        scrollAboveComposer(target);
      });
    });
  };

  const highlight = (commentId: string) => {
    cancelTimer(highlightTimerRef);
    highlightedComment.set(commentId);
    highlightTimerRef.current = setTimeout(() => {
      highlightTimerRef.current = null;
      highlightedComment.set(null);
    }, TODO_COMMENT_HIGHLIGHT_DURATION_MS);
  };

  const clearHighlight = () => {
    cancelTimer(highlightTimerRef);
    highlightedComment.set(null);
  };

  useEffect(
    () => () => {
      cancelPendingReveal(pendingRef, frameRef);
      cancelTimer(highlightTimerRef);
    },
    [],
  );

  return (
    <TodoCommentRevealContext
      value={{
        listRef,
        composerRef,
        extraContentPadding,
        reveal,
        showAboveComposer: scrollAboveComposer,
        highlight,
        clearHighlight,
        highlightedComment,
      }}
    >
      {children}
    </TodoCommentRevealContext>
  );
}

function cancelPendingReveal(
  pendingRef: RefObject<{ remove: () => void } | null>,
  frameRef: RefObject<number | null>,
) {
  pendingRef.current?.remove();
  pendingRef.current = null;
  if (frameRef.current != null) {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }
}

function cancelTimer(timerRef: RefObject<ReturnType<typeof setTimeout> | null>) {
  if (timerRef.current != null) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

export function useTodoCommentReveal(): TodoCommentRevealValue {
  const value = use(TodoCommentRevealContext);
  if (value == null) {
    throw new Error('useTodoCommentReveal must be used inside TodoCommentRevealProvider');
  }

  return value;
}

/** 이 댓글의 강조가 켜지고 꺼질 때만 다시 그린다. 글이 없는 줄(null)은 늘 false다 */
export function useIsTodoCommentHighlighted(commentId: string | null): boolean {
  const { highlightedComment } = useTodoCommentReveal();

  return useSyncExternalStore(
    highlightedComment.subscribe,
    () => commentId != null && highlightedComment.get() === commentId,
  );
}
