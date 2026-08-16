import '@src/shared/i18n/init';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { fireEvent, screen } from '@testing-library/react-native';

import type { TodoCommentAuthor } from '../../models/todo-comment.model';
import { CommentComposerSheet } from './CommentComposerSheet';

const author: TodoCommentAuthor = {
  id: 'user-1',
  name: '매튜',
  profileImage: null,
  isTodoOwner: false,
};

function renderComposer(onSubmit: jest.Mock) {
  return renderUi(
    <CommentComposerSheet
      author={author}
      target={null}
      isOpen
      isSubmitting={false}
      onOpenChange={jest.fn()}
      onSubmit={onSubmit}
    />,
  );
}

// RTL 14의 render·fireEvent는 비동기다 — 기다리지 않으면 다음 단언이 이전 상태를 본다.
const post = () => fireEvent.press(screen.getByTestId('comment-composer-post'));
const type = (index: number, text: string) =>
  fireEvent.changeText(screen.getByTestId(`comment-composer-input-${index}`), text);
const addRow = () => fireEvent.press(screen.getByTestId('comment-composer-add'));

/**
 * 게시 버튼을 formState.isValid에 걸었다가 내용을 써도 열리지 않은 적이 있다.
 * 그때는 렌더 테스트를 쓸 수 없어 훅 테스트로 물러섰다 — 이 파일이 그 자리를 메운다.
 */
describe('CommentComposerSheet', () => {
  it('빈 칸에서는 게시가 열리지 않는다', async () => {
    const onSubmit = jest.fn();
    await renderComposer(onSubmit);

    await post();

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('내용을 쓰면 게시가 열리고, 앞뒤 공백은 다듬어 나간다', async () => {
    const onSubmit = jest.fn();
    await renderComposer(onSubmit);

    await type(0, '  첫 댓글  ');
    await post();

    expect(onSubmit).toHaveBeenCalledWith(['첫 댓글']);
  });

  it('이어 쓰기를 열면 모든 칸을 채워야 게시가 열린다', async () => {
    const onSubmit = jest.fn();
    await renderComposer(onSubmit);

    await type(0, '첫 글');
    await addRow();

    await post();
    expect(onSubmit).not.toHaveBeenCalled();

    await type(1, '이어지는 글');
    await post();

    expect(onSubmit).toHaveBeenCalledWith(['첫 글', '이어지는 글']);
  });
});
