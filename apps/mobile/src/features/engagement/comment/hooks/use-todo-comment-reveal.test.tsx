import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act } from '@testing-library/react-native';

import { TODO_COMMENT_HIGHLIGHT_DURATION_MS } from '../constants/todo-comment.constants';
import {
  TodoCommentRevealProvider,
  useIsTodoCommentHighlighted,
  useTodoCommentReveal,
} from './use-todo-comment-reveal';

interface RowProbeProps {
  commentId: string | null;
  onRender: (isHighlighted: boolean) => void;
}

/** 댓글 행처럼 자기 댓글의 강조만 읽는다 */
function RowProbe({ commentId, onRender }: RowProbeProps) {
  onRender(useIsTodoCommentHighlighted(commentId));
  return null;
}

/** 목록처럼 알림으로 연 댓글을 강조하기만 한다 */
function ListProbe({ onRender }: { onRender: (highlight: (commentId: string) => void) => void }) {
  const { highlight } = useTodoCommentReveal();
  onRender(highlight);
  return null;
}

describe('useIsTodoCommentHighlighted', () => {
  setupFakeTimersPerTest();

  it('강조가 켜지고 꺼질 때 그 댓글 행만 다시 그리고 다른 행과 목록은 다시 그리지 않는다', async () => {
    // Given
    const anchoredRow = jest.fn<void, [boolean]>();
    const otherRow = jest.fn<void, [boolean]>();
    const moreRow = jest.fn<void, [boolean]>();
    const list = jest.fn<void, [(commentId: string) => void]>();
    await renderScreen(
      <TodoCommentRevealProvider>
        <RowProbe commentId="comment-1" onRender={anchoredRow} />
        <RowProbe commentId="comment-2" onRender={otherRow} />
        <RowProbe commentId={null} onRender={moreRow} />
        <ListProbe onRender={list} />
      </TodoCommentRevealProvider>,
    );
    const highlight = list.mock.lastCall?.[0];
    if (highlight == null) {
      throw new Error('탐침이 그려지지 않았습니다');
    }
    jest.clearAllMocks();

    // When
    await act(async () => highlight('comment-1'));

    // Then
    expect(anchoredRow.mock.calls).toEqual([[true]]);

    // When
    await act(async () => jest.advanceTimersByTime(TODO_COMMENT_HIGHLIGHT_DURATION_MS));

    // Then
    expect(anchoredRow.mock.calls).toEqual([[true], [false]]);
    expect(otherRow).not.toHaveBeenCalled();
    expect(moreRow).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });
});
