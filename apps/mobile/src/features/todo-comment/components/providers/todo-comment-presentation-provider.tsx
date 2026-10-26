import { useNavigation } from 'expo-router';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { TodoCommentPresentation } from '../../utils/navigation/todo-comment-route';

/** push 전환이 끝났다는 이벤트를 놓쳐도 작성기 focus가 막히지 않게 하는 상한. 기본 push 전환보다 길다. */
const SCREEN_ENTER_FALLBACK_MS = 1000;

interface TodoCommentPresentationValue {
  presentation: TodoCommentPresentation;
  /** Stack 화면의 push 전환이 끝났는지. 전환 중에 키보드를 올리면 화면과 키보드가 따로 움직인다. */
  hasEnteredScreen: boolean;
}

interface StackTransitionNavigation {
  addListener(
    event: 'transitionEnd',
    callback: (event: { data: { closing: boolean } }) => void,
  ): () => void;
}

const TodoCommentPresentationContext = createContext<TodoCommentPresentationValue | null>(null);

interface TodoCommentPresentationProviderProps extends PropsWithChildren {
  presentation: TodoCommentPresentation;
}

/** 댓글 화면이 Stack 화면인지 펼친 피드의 pane인지 알린다. 이동 방법(push·pop 또는 search 변경)이 여기서 갈린다. */
export function TodoCommentPresentationProvider({
  presentation,
  children,
}: TodoCommentPresentationProviderProps) {
  const hasEnteredScreen = useHasEnteredScreen(presentation === 'screen');
  const value = useMemo(
    () => ({ presentation, hasEnteredScreen }),
    [hasEnteredScreen, presentation],
  );

  return <TodoCommentPresentationContext value={value}>{children}</TodoCommentPresentationContext>;
}

function useHasEnteredScreen(isStackScreen: boolean): boolean {
  const navigation = useNavigation<StackTransitionNavigation>();
  const [hasEnteredScreen, setHasEnteredScreen] = useState(!isStackScreen);

  useEffect(() => {
    if (hasEnteredScreen) {
      return;
    }

    const unsubscribe = navigation.addListener('transitionEnd', (event) => {
      if (!event.data.closing) {
        setHasEnteredScreen(true);
      }
    });
    const fallback = setTimeout(() => setHasEnteredScreen(true), SCREEN_ENTER_FALLBACK_MS);

    return () => {
      unsubscribe();
      clearTimeout(fallback);
    };
  }, [hasEnteredScreen, navigation]);

  return hasEnteredScreen;
}

function useTodoCommentPresentationValue(): TodoCommentPresentationValue {
  const value = useContext(TodoCommentPresentationContext);

  if (value == null) {
    throw new Error('댓글 표시 방식은 TodoCommentPresentationProvider 안에서 사용해 주세요.');
  }

  return value;
}

export function useTodoCommentPresentation(): TodoCommentPresentation {
  return useTodoCommentPresentationValue().presentation;
}

/** 작성기를 연 채 push한 화면은 전환이 끝난 뒤 focus해 키보드가 화면과 따로 올라오지 않게 한다. */
export function useHasEnteredTodoCommentScreen(): boolean {
  return useTodoCommentPresentationValue().hasEnteredScreen;
}
