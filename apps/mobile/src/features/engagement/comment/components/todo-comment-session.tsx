import { zodResolver } from '@hookform/resolvers/zod';
import { useLogger } from '@src/bootstrap/providers/di-context';
import { getErrorMessage } from '@src/shared/errors';
import { useFocusEffect } from 'expo-router';
import { type PropsWithChildren, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { KeyboardController } from 'react-native-keyboard-controller';

import { TODO_COMMENT_LOG_EVENT } from '../constants/todo-comment-log-events';
import { useAndroidTodoCommentBackHandler } from '../hooks/use-android-todo-comment-back-handler';
import { TodoCommentDeleteProvider } from '../hooks/use-confirm-todo-comment-delete';
import { TodoCommentFormProvider } from '../hooks/use-todo-comment-form';
import {
  EMPTY_TODO_COMMENT_FORM_VALUES,
  todoCommentFormSchema,
} from '../schemas/todo-comment-form.schema';
import { TodoCommentExpansionProvider } from './todo-comment-expansion';
import { TodoCommentRevealProvider } from './todo-comment-reveal';

interface TodoCommentSessionProps extends PropsWithChildren {
  /** 더 닫을 게 없을 때 Android 뒤로가기가 부르는 일. 펼친 피드 칸은 선택을 풀고, 전체 화면은 기본 뒤로가기다 */
  onExit?: () => void;
}

/** 한 할 일의 작성기(새 댓글·답글·수정) 폼과 펼친 묶음, 키보드 위치, 삭제 확인을 그 아래 조각들이 함께 쓴다 */
export function TodoCommentSession({ onExit, children }: TodoCommentSessionProps) {
  const form = useForm({
    resolver: zodResolver(todoCommentFormSchema),
    defaultValues: EMPTY_TODO_COMMENT_FORM_VALUES,
    mode: 'onChange',
  });

  return (
    <TodoCommentFormProvider form={form}>
      <TodoCommentRevealProvider>
        <TodoCommentExpansionProvider>
          <TodoCommentDeleteProvider>
            <BackAndKeyboardEffects onExit={onExit} />
            {children}
          </TodoCommentDeleteProvider>
        </TodoCommentExpansionProvider>
      </TodoCommentRevealProvider>
    </TodoCommentFormProvider>
  );
}

function BackAndKeyboardEffects({ onExit }: Pick<TodoCommentSessionProps, 'onExit'>) {
  const logger = useLogger();

  useAndroidTodoCommentBackHandler({ onExit });

  // 작성 중에 알림이나 다른 화면이 위에 쌓이면 가려진 작성기가 first responder로 남아 새 화면 위에 키보드가
  // 떠 있다. 화면이 focus를 잃을 때 키보드를 내린다. 작성 내용은 초안 저장소에 남는다.
  useFocusEffect(
    useCallback(
      () => () => {
        KeyboardController.dismiss().catch((error) =>
          logger.warn(TODO_COMMENT_LOG_EVENT.KEYBOARD_DISMISS_FAILED, {
            error: getErrorMessage(error),
          }),
        );
      },
      [logger],
    ),
  );

  return null;
}
