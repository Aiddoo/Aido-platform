import { resolveMemoSelection } from './memo-selection';

describe('resolveMemoSelection', () => {
  it('compact에서 메모를 고르면 상세 라우트로 push한다', () => {
    expect(resolveMemoSelection('compact', 3)).toEqual({ type: 'push', memoId: 3 });
  });

  it('compact에서 선택 해제는 아무것도 하지 않는다', () => {
    expect(resolveMemoSelection('compact', undefined)).toEqual({ type: 'none' });
  });

  it('medium 이상에서는 메모 탭 URL의 memoId를 바꾼다', () => {
    expect(resolveMemoSelection('medium', 3)).toEqual({
      type: 'setParams',
      params: { memoId: '3' },
    });
  });

  it('medium 이상에서 선택 해제는 memoId를 지운다', () => {
    expect(resolveMemoSelection('expanded', undefined)).toEqual({
      type: 'setParams',
      params: { memoId: undefined },
    });
  });
});
