import { getCommentComposerChainFieldLayout } from './comment-composer-chain-layout';

describe('getCommentComposerChainFieldLayout', () => {
  it('글이 하나면 연결선과 삭제 없이 제출 동작만 둔다', () => {
    expect(getCommentComposerChainFieldLayout(0, 1)).toEqual({
      connectsToNext: false,
      showsRemoveAction: false,
      showsSubmissionActions: true,
    });
  });

  it('여러 글의 첫 글은 다음 아바타로 잇고 제출 동작을 두지 않는다', () => {
    expect(getCommentComposerChainFieldLayout(0, 5)).toEqual({
      connectsToNext: true,
      showsRemoveAction: false,
      showsSubmissionActions: false,
    });
  });

  it('여러 글의 가운데 글은 연결과 삭제만 제공한다', () => {
    expect(getCommentComposerChainFieldLayout(2, 5)).toEqual({
      connectsToNext: true,
      showsRemoveAction: true,
      showsSubmissionActions: false,
    });
  });

  it('다섯 번째 마지막 글도 제출 동작은 한 곳에만 둔다', () => {
    expect(getCommentComposerChainFieldLayout(4, 5)).toEqual({
      connectsToNext: false,
      showsRemoveAction: true,
      showsSubmissionActions: true,
    });
  });
});
