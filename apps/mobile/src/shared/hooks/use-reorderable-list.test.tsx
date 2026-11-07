import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { createTestDi } from '@src/shared/__tests__';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useReorderableList } from './use-reorderable-list';

type Item = { id: number };

const A = { id: 1 };
const B = { id: 2 };
const C = { id: 3 };

async function renderReorderableList(initial: { items: Item[]; updatedAt: number }) {
  const onReorder = jest.fn();
  const container = createTestDi();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StaticDIProvider container={container}>{children}</StaticDIProvider>
  );
  const view = await renderHook(
    (props: { items: Item[]; updatedAt: number; isPending: boolean }) =>
      useReorderableList({ ...props, getItemId: (item: Item) => item.id, onReorder }),
    { initialProps: { ...initial, isPending: false }, wrapper },
  );

  return { ...view, onReorder };
}

describe('useReorderableList', () => {
  it('놓으면 응답이 오고 서버 값이 새로 올 때까지 옮긴 순서를 붙잡는다', async () => {
    // Given
    const { result, rerender, onReorder } = await renderReorderableList({
      items: [A, B, C],
      updatedAt: 1,
    });

    // When
    await act(async () => {
      result.current.onReorder({ from: 0, to: 2 });
    });
    await rerender({ items: [A, B, C], updatedAt: 1, isPending: true });

    // Then
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual([B, C, A]);
    expect(result.current.dragEnabled).toBe(false);

    // When
    await rerender({ items: [A, B, C], updatedAt: 1, isPending: false });

    // Then
    expect(result.current.data).toEqual([B, C, A]);

    // When
    await rerender({ items: [B, C, A], updatedAt: 2, isPending: false });

    // Then
    expect(result.current.data).toEqual([B, C, A]);
    expect(result.current.dragEnabled).toBe(true);
  });

  it('요청이 실패해 같은 순서가 다시 오면 서버 순서로 돌아간다', async () => {
    // Given
    const { result, rerender } = await renderReorderableList({ items: [A, B], updatedAt: 1 });
    await act(async () => {
      result.current.onReorder({ from: 0, to: 1 });
    });

    // When
    await rerender({ items: [A, B], updatedAt: 2, isPending: false });

    // Then
    expect(result.current.data).toEqual([A, B]);
  });

  it('응답을 기다리는 동안 들어온 서버 값은 끝난 뒤에 반영한다', async () => {
    // Given
    const { result, rerender } = await renderReorderableList({ items: [A, B], updatedAt: 1 });
    await act(async () => {
      result.current.onReorder({ from: 0, to: 1 });
    });

    // When
    await rerender({ items: [A, B, C], updatedAt: 2, isPending: true });

    // Then
    expect(result.current.data).toEqual([B, A]);

    // When
    await rerender({ items: [A, B, C], updatedAt: 2, isPending: false });

    // Then
    expect(result.current.data).toEqual([A, B, C]);
  });
});
