import { useCommentForm } from '@src/features/todo-comment/presentations/hooks/use-comment-form';
import { commentFormSchema } from '@src/features/todo-comment/presentations/schemas/comment-form.schema';
import { act, renderHook, waitFor } from '@testing-library/react-native';

describe('commentFormSchema', () => {
  test('내용이 채워지면 통과한다', () => {
    expect(commentFormSchema.safeParse({ items: [{ content: '123' }] }).success).toBe(true);
  });

  test('빈 칸이 하나라도 있으면 막힌다', () => {
    expect(commentFormSchema.safeParse({ items: [{ content: '' }] }).success).toBe(false);
    expect(
      commentFormSchema.safeParse({ items: [{ content: 'a' }, { content: '' }] }).success,
    ).toBe(false);
  });
});

describe('useCommentForm', () => {
  test('쓴 내용이 값으로 그대로 읽힌다 — 게시 버튼은 이 값으로 열린다', async () => {
    const { result } = await renderHook(() => useCommentForm());

    expect(result.current.getValues('items').every((item) => item.content === '')).toBe(true);

    await act(async () => {
      result.current.setValue('items.0.content', '  안녕  ');
    });

    await waitFor(() =>
      expect(result.current.getValues('items').every((item) => item.content.trim() !== '')).toBe(
        true,
      ),
    );
  });

  /**
   * 게시 버튼을 formState.isValid에 걸었다가 내용을 써도 열리지 않았다.
   * useFieldArray가 배열을 갈아 끼우면 isValid가 따라오지 않는 순간이 있어서,
   * 화면은 검증 플래그가 아니라 값 자체를 본다. 이 테스트가 그 사실을 붙잡아 둔다.
   */
  test('isValid는 값이 채워져도 따라오지 않는다 — 그래서 게시 조건으로 쓰지 않는다', async () => {
    const { result } = await renderHook(() => useCommentForm());

    await act(async () => {
      result.current.register('items.0.content');
      result.current.setValue('items.0.content', '안녕');
    });
    await act(async () => {
      await result.current.trigger();
    });

    expect(result.current.formState.isValid).toBe(false);
    expect(result.current.getValues('items.0.content')).toBe('안녕');
  });
});
