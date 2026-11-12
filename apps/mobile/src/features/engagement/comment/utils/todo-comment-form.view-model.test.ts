import { createTodoComment } from '../__tests__/todo-comment.fixtures';
import {
  findComposerTarget,
  getFocusedCommentFieldIndexAfterRemoval,
  getTrimmedContents,
  isComposerBlank,
} from './todo-comment-form.view-model';

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

describe('isComposerBlank', () => {
  it('모든 칸이 비었거나 공백뿐이면 true를 반환한다', () => {
    // Given
    const values = { items: [{ content: '' }, { content: '  \n' }] };

    // When
    const result = isComposerBlank(values);

    // Then
    expect(result).toBe(true);
  });

  it('한 칸이라도 쓴 글이 있으면 false를 반환한다', () => {
    // Given
    const values = { items: [{ content: '' }, { content: '쓰던 글' }] };

    // When
    const result = isComposerBlank(values);

    // Then
    expect(result).toBe(false);
  });
});

describe('getTrimmedContents', () => {
  it('보낼 글은 앞뒤 공백을 지운다', () => {
    // Given
    const items = [{ content: '  하나 ' }, { content: '둘\n' }];

    // When
    const contents = getTrimmedContents(items);

    // Then
    expect(contents).toEqual(['하나', '둘']);
  });

  it('칸이 하나도 없으면 null을 반환한다', () => {
    // When
    const contents = getTrimmedContents([]);

    // Then
    expect(contents).toBeNull();
  });
});

describe('findComposerTarget', () => {
  it('새 글이면 대상이 없다', () => {
    // When
    const target = findComposerTarget({ type: 'new' });

    // Then
    expect(target).toBeNull();
  });

  it('답글과 수정은 고른 글을 대상으로 한다', () => {
    // Given
    const comment = createTodoComment();

    // When
    const targets = [
      findComposerTarget({ type: 'reply', target: comment }),
      findComposerTarget({ type: 'edit', target: comment }),
    ];

    // Then
    expect(targets).toEqual([comment, comment]);
  });
});
