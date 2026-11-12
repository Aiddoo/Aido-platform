import { getCommentFormMaxHeight } from './todo-comment-form.geometry';

describe('getCommentFormMaxHeight', () => {
  it('작은 화면에서는 목록이 남도록 최소 높이를 쓴다', () => {
    // When
    const result = getCommentFormMaxHeight(360);

    // Then
    expect(result).toBe(176);
  });

  it('일반 화면에서는 화면 높이에 비례한다', () => {
    // When
    const result = getCommentFormMaxHeight(700);

    // Then
    expect(result).toBe(280);
  });

  it('큰 화면에서도 작성기가 지나치게 커지지 않는다', () => {
    // When
    const result = getCommentFormMaxHeight(1_000);

    // Then
    expect(result).toBe(320);
  });
});
