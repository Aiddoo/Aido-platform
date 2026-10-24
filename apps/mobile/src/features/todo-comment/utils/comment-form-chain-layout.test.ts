import { getCommentFormChainFieldLayout } from './comment-form-chain-layout';

describe('getCommentFormChainFieldLayout', () => {
  it('글이 하나면 연결선과 삭제 없이 제출 동작만 둔다', () => {
    expect(getCommentFormChainFieldLayout(0, 1)).toEqual({
      isConnectedToNext: false,
      shouldShowRemoveAction: false,
      shouldShowSubmissionActions: true,
    });
  });

  it('여러 글의 첫 글은 다음 아바타로 잇고 제출 동작을 두지 않는다', () => {
    expect(getCommentFormChainFieldLayout(0, 5)).toEqual({
      isConnectedToNext: true,
      shouldShowRemoveAction: false,
      shouldShowSubmissionActions: false,
    });
  });

  it('여러 글의 가운데 글은 연결과 삭제만 제공한다', () => {
    expect(getCommentFormChainFieldLayout(2, 5)).toEqual({
      isConnectedToNext: true,
      shouldShowRemoveAction: true,
      shouldShowSubmissionActions: false,
    });
  });

  it('다섯 번째 마지막 글도 제출 동작은 한 곳에만 둔다', () => {
    expect(getCommentFormChainFieldLayout(4, 5)).toEqual({
      isConnectedToNext: false,
      shouldShowRemoveAction: true,
      shouldShowSubmissionActions: true,
    });
  });
});
