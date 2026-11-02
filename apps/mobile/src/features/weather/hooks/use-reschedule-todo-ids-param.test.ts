import {
  rescheduleTodoIdsParamSchema,
  toRescheduleTodoIdsParam,
} from './use-reschedule-todo-ids-param';

describe('rescheduleTodoIdsParamSchema', () => {
  it.each([
    ['12,15', [12, 15]],
    ['7', [7]],
  ])('todoIds=%s를 할 일 id 목록으로 읽는다', (todoIds, expected) => {
    // When
    const result = rescheduleTodoIdsParamSchema.safeParse({ todoIds });

    // Then
    expect(result.success && result.data.todoIds).toEqual(expected);
  });

  it.each([undefined, '', 'abc', '0'])('todoIds=%s처럼 잘못된 값은 거부한다', (todoIds) => {
    // When
    const result = rescheduleTodoIdsParamSchema.safeParse({ todoIds });

    // Then
    expect(result.success).toBe(false);
  });

  it('할 일 id 목록을 같은 형식의 URL 값으로 되돌린다', () => {
    // When
    const param = toRescheduleTodoIdsParam([12, 15]);

    // Then
    expect(rescheduleTodoIdsParamSchema.parse({ todoIds: param }).todoIds).toEqual([12, 15]);
  });
});
