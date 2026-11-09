import type { FlashListRef } from '@shopify/flash-list';
import {
  type ComponentRef,
  createContext,
  type PropsWithChildren,
  type RefObject,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import type { View } from 'react-native';
import { KeyboardController, KeyboardEvents } from 'react-native-keyboard-controller';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';

import type { TodoCommentThread } from '../domains/todo-comment.model';

const REVEAL_MARGIN = 16;

interface TodoCommentRevealValue {
  listRef: RefObject<FlashListRef<TodoCommentThread> | null>;
  composerRef: RefObject<ComponentRef<typeof View> | null>;
  /** 키보드가 열린 채 작성기가 커지면 목록 끝을 그만큼 더 올린다 */
  extraContentPadding: SharedValue<number>;
  reveal: (target: RefObject<ComponentRef<typeof View> | null>) => void;
  /** 키보드와 무관하게 행이 작성 바에 가려 있으면 그만큼 올린다(알림으로 연 답글) */
  showAboveComposer: (target: RefObject<ComponentRef<typeof View> | null>) => void;
}

const TodoCommentRevealContext = createContext<TodoCommentRevealValue | null>(null);

/**
 * 답글 달기·수정을 누른 행이 키보드 위 작성 바에 가리지 않게 목록을 그만큼만 올린다.
 * 키보드가 다 올라온 뒤 실제 화면 위치로 재므로 글자 크기·행 높이와 무관하다.
 */
export function TodoCommentRevealProvider({ children }: PropsWithChildren) {
  const listRef = useRef<FlashListRef<TodoCommentThread>>(null);
  const composerRef = useRef<ComponentRef<typeof View>>(null);
  const extraContentPadding = useSharedValue(0);
  const pendingRef = useRef<{ remove: () => void } | null>(null);
  const frameRef = useRef<number | null>(null);

  const clearPending = useCallback(() => {
    pendingRef.current?.remove();
    pendingRef.current = null;
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const scrollAboveComposer = useCallback((target: RefObject<ComponentRef<typeof View> | null>) => {
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
  }, []);

  const reveal = useCallback(
    (target: RefObject<ComponentRef<typeof View> | null>) => {
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
    },
    [clearPending, scrollAboveComposer],
  );

  useEffect(() => clearPending, [clearPending]);

  const value = useMemo(
    () => ({
      listRef,
      composerRef,
      extraContentPadding,
      reveal,
      showAboveComposer: scrollAboveComposer,
    }),
    [extraContentPadding, reveal, scrollAboveComposer],
  );

  return <TodoCommentRevealContext value={value}>{children}</TodoCommentRevealContext>;
}

export function useTodoCommentReveal(): TodoCommentRevealValue {
  const value = use(TodoCommentRevealContext);
  if (value == null) {
    throw new Error('useTodoCommentReveal must be used inside TodoCommentRevealProvider');
  }

  return value;
}
