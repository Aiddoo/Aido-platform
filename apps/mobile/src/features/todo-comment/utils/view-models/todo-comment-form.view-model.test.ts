import { toTodoCommentAuthor } from './todo-comment-form.view-model';

describe('toTodoCommentAuthor', () => {
  test('현재 사용자와 할 일 소유자를 비교해 작성자 badge 근거를 만든다', () => {
    expect(
      toTodoCommentAuthor(
        { id: 'user-1', name: '김철수', profileImage: 'https://example.com/profile.png' },
        'user-1',
      ),
    ).toEqual({
      id: 'user-1',
      name: '김철수',
      profileImage: 'https://example.com/profile.png',
      isTodoOwner: true,
    });
  });
});
