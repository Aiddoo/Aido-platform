import { toTodoEditedFields } from './todo-analytics';

describe('toTodoEditedFields', () => {
  it('고친 칸을 넣은 순서와 상관없이 폼 순서로 쉼표로 잇는다', () => {
    // Given
    const fields = { isAllDay: true, title: '장보기', categoryId: 3 };
    // When
    const edited = toTodoEditedFields(fields);
    // Then
    expect(edited).toBe('title,categoryId,isAllDay');
  });

  it('칸 하나만 고치면 그 칸 이름이다', () => {
    // When
    const edited = toTodoEditedFields({ categoryId: 3 });
    // Then
    expect(edited).toBe('categoryId');
  });

  it('칸을 고치지 않고 반복만 끝내면 repeat이다', () => {
    // When
    const edited = toTodoEditedFields({}, { repeat: null });
    // Then
    expect(edited).toBe('repeat');
  });

  it('칸과 반복을 함께 바꾸면 고친 칸만 남는다', () => {
    // When
    const edited = toTodoEditedFields({ title: '장보기' }, { repeat: null });
    // Then
    expect(edited).toBe('title');
  });

  it('칸도 반복도 바꾸지 않으면 보내지 않는다', () => {
    // When
    const edited = toTodoEditedFields({});
    // Then
    expect(edited).toBeUndefined();
  });
});
