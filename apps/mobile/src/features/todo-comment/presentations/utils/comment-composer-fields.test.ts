import { getFocusedCommentFieldIndexAfterRemoval } from './comment-composer-fields';

describe('getFocusedCommentFieldIndexAfterRemoval', () => {
  it('focus 앞의 field를 지우면 index를 한 칸 당긴다', () => {
    expect(getFocusedCommentFieldIndexAfterRemoval(3, 1)).toBe(2);
  });

  it('focus 뒤의 field를 지우면 현재 index를 유지한다', () => {
    expect(getFocusedCommentFieldIndexAfterRemoval(1, 3)).toBe(1);
  });

  it('focus field를 지우면 바로 앞 field로 옮긴다', () => {
    expect(getFocusedCommentFieldIndexAfterRemoval(3, 3)).toBe(2);
    expect(getFocusedCommentFieldIndexAfterRemoval(0, 0)).toBe(0);
  });
});
