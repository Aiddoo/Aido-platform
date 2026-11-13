import { renderScreenHook } from '@src/testing/render';
import { act } from '@testing-library/react-native';

import { useReorderableList } from './use-reorderable-list';

type Item = { id: number };

const A = { id: 1 };
const B = { id: 2 };
const C = { id: 3 };

async function renderReorderableList({
  isOptimistic,
  ...initial
}: {
  items: Item[];
  updatedAt: number;
  isOptimistic?: (item: Item) => boolean;
}) {
  const onReorder = jest.fn();
  const view = await renderScreenHook(
    (props: { items: Item[]; updatedAt: number; isPending: boolean }) =>
      useReorderableList({ ...props, getItemId: (item: Item) => item.id, isOptimistic, onReorder }),
    { initialProps: { ...initial, isPending: false } },
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

  it('라이브러리 셀이 한 렌더 전의 끌기 시작 콜백을 불러도 임시 행이 서버 행으로 바뀐 지금 목록의 순서를 보낸다', async () => {
    // Given
    const optimistic = { id: -1 };
    const saved = { id: 4 };
    const { result, rerender, onReorder } = await renderReorderableList({
      items: [A, optimistic],
      updatedAt: 1,
    });
    // 셀은 렌더 뒤 layout effect에서야 새 콜백을 받아 확정 렌더가 끝난 뒤에도 그 전 콜백을 쥔다
    const staleOnDragStart = result.current.onDragStart;
    await rerender({ items: [A, saved], updatedAt: 2, isPending: false });

    // When
    await act(async () => {
      staleOnDragStart();
    });
    await act(async () => {
      result.current.onReorder({ from: 1, to: 0 });
    });

    // Then
    expect(onReorder).toHaveBeenCalledWith({
      instruction: { movedId: 4, targetId: 1, position: 'before' },
      items: [saved, A],
    });
  });

  it('임시 행이 있으면 끌 수 없고 그래도 임시 행 뒤로 놓인 끌기는 순서를 보내지 않고 서버 순서로 돌아간다', async () => {
    // Given
    const optimistic = { id: -1 };
    const { result, onReorder } = await renderReorderableList({
      items: [A, B, optimistic],
      updatedAt: 1,
      isOptimistic: (item) => item.id < 0,
    });

    // Then
    expect(result.current.dragEnabled).toBe(false);

    // When
    await act(async () => {
      result.current.onDragStart();
    });
    await act(async () => {
      result.current.onReorder({ from: 0, to: 2 });
    });

    // Then
    expect(onReorder).not.toHaveBeenCalled();
    expect(result.current.data).toEqual([A, B, optimistic]);
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
