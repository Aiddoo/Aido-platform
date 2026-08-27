import { getCommentComposerMaxHeight } from './comment-composer-layout';

describe('getCommentComposerMaxHeight', () => {
  it('작은 화면에서는 목록이 남도록 최소 높이를 쓴다', () => {
    expect(getCommentComposerMaxHeight(360)).toBe(176);
  });

  it('일반 화면에서는 화면 높이에 비례한다', () => {
    expect(getCommentComposerMaxHeight(700)).toBe(280);
  });

  it('큰 화면에서도 작성기가 지나치게 커지지 않는다', () => {
    expect(getCommentComposerMaxHeight(1_000)).toBe(320);
  });
});
