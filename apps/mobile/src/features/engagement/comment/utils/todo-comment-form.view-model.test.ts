import { getFocusedCommentFieldIndexAfterRemoval } from './todo-comment-form.view-model';

describe('getFocusedCommentFieldIndexAfterRemoval', () => {
  it('focus 앞의 field를 지우면 index를 한 칸 당긴다', () => {
    // When
    const index = getFocusedCommentFieldIndexAfterRemoval(3, 1);

    // Then
    expect(index).toBe(2);
  });

  it('focus 뒤의 field를 지우면 현재 index를 유지한다', () => {
    // When
    const index = getFocusedCommentFieldIndexAfterRemoval(1, 3);

    // Then
    expect(index).toBe(1);
  });

  it('focus field를 지우면 바로 앞 field로 옮긴다', () => {
    // When
    const index = getFocusedCommentFieldIndexAfterRemoval(3, 3);

    // Then
    expect(index).toBe(2);
  });

  it('첫 field를 지우면 첫 field에 머무른다', () => {
    // When
    const index = getFocusedCommentFieldIndexAfterRemoval(0, 0);

    // Then
    expect(index).toBe(0);
  });
});
