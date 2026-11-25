import { renderScreen } from '@src/testing/render';
import { act } from '@testing-library/react-native';

import type { ThreadExpansion } from '../utils/todo-comment-replies.view-model';
import {
  TodoCommentExpansionProvider,
  useExpandThread,
  useThreadExpansion,
} from './todo-comment-expansion';

const COLLAPSED: ThreadExpansion = { isExpanded: false, source: 'user' };

interface ThreadProbeProps {
  threadCommentId: string;
  onRender: (expansion: ThreadExpansion, setExpansion: (next: ThreadExpansion) => void) => void;
}

/** 묶음의 답글 목록처럼 자기 묶음의 펼침만 읽는다 */
function ThreadProbe({ threadCommentId, onRender }: ThreadProbeProps) {
  const [expansion, setExpansion] = useThreadExpansion(threadCommentId, COLLAPSED);
  onRender(expansion, setExpansion);
  return null;
}

/** 작성기처럼 답글을 올린 묶음을 펼치기만 한다 */
function ComposerProbe({ onRender }: { onRender: (expand: (id: string) => void) => void }) {
  const expandThread = useExpandThread();
  onRender(expandThread);
  return null;
}

async function renderProbes() {
  const firstThread = jest.fn<void, Parameters<ThreadProbeProps['onRender']>>();
  const secondThread = jest.fn<void, Parameters<ThreadProbeProps['onRender']>>();
  const composer = jest.fn<void, [(id: string) => void]>();
  await renderScreen(
    <TodoCommentExpansionProvider>
      <ThreadProbe threadCommentId="thread-1" onRender={firstThread} />
      <ThreadProbe threadCommentId="thread-2" onRender={secondThread} />
      <ComposerProbe onRender={composer} />
    </TodoCommentExpansionProvider>,
  );
  const expandThread = composer.mock.lastCall?.[0];
  const setFirstExpansion = firstThread.mock.lastCall?.[1];
  if (expandThread == null || setFirstExpansion == null) {
    throw new Error('탐침이 그려지지 않았습니다');
  }
  jest.clearAllMocks();

  return { firstThread, secondThread, composer, expandThread, setFirstExpansion };
}

describe('useThreadExpansion', () => {
  it('묶음 하나를 펼치면 그 묶음만 다시 그리고 다른 묶음과 작성기는 다시 그리지 않는다', async () => {
    // Given
    const { firstThread, secondThread, composer, setFirstExpansion } = await renderProbes();

    // When
    await act(async () => setFirstExpansion({ isExpanded: true, source: 'user' }));

    // Then
    expect(firstThread).toHaveBeenCalledTimes(1);
    expect(firstThread.mock.lastCall?.[0]).toEqual({ isExpanded: true, source: 'user' });
    expect(secondThread).not.toHaveBeenCalled();
    expect(composer).not.toHaveBeenCalled();
  });
});

describe('useExpandThread', () => {
  it('답글을 올린 묶음만 자동 펼침으로 다시 그리고 작성기는 다시 그리지 않는다', async () => {
    // Given
    const { firstThread, secondThread, composer, expandThread } = await renderProbes();

    // When
    await act(async () => expandThread('thread-2'));

    // Then
    expect(secondThread).toHaveBeenCalledTimes(1);
    expect(secondThread.mock.lastCall?.[0]).toEqual({ isExpanded: true, source: 'auto' });
    expect(firstThread).not.toHaveBeenCalled();
    expect(composer).not.toHaveBeenCalled();
  });

  it('사용자가 직접 편 묶음은 답글을 올려도 그대로라 다시 그리지 않는다', async () => {
    // Given
    const { firstThread, expandThread, setFirstExpansion } = await renderProbes();
    await act(async () => setFirstExpansion({ isExpanded: true, source: 'user' }));
    firstThread.mockClear();

    // When
    await act(async () => expandThread('thread-1'));

    // Then
    expect(firstThread).not.toHaveBeenCalled();
  });
});
