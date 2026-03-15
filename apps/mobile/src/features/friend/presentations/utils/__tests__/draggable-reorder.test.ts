import { getFriendReorderInstruction } from '../draggable-reorder';

const createItems = (followIds: string[]) => followIds.map((followId) => ({ followId }));

describe('getFriendReorderInstruction', () => {
  it('같은 위치면 null을 반환한다', () => {
    // Given - 같은 from/to
    const items = createItems(['a', 'b', 'c']);

    // When
    const result = getFriendReorderInstruction(items, 1, 1);

    // Then
    expect(result).toBeNull();
  });

  it('맨 앞으로 이동하면 첫 번째 아이템 앞으로 배치한다', () => {
    // Given - index 2 → 0으로 이동 후 재정렬된 배열
    const items = createItems(['c', 'a', 'b']);

    // When
    const result = getFriendReorderInstruction(items, 2, 0);

    // Then
    expect(result).toEqual({
      movedFollowId: 'c',
      targetFollowId: 'a',
      position: 'before',
    });
  });

  it('중간 위치로 이동하면 이전 아이템 뒤로 배치한다', () => {
    // Given - index 0 → 2로 이동 후 재정렬된 배열
    const items = createItems(['b', 'c', 'a']);

    // When
    const result = getFriendReorderInstruction(items, 0, 2);

    // Then
    expect(result).toEqual({
      movedFollowId: 'a',
      targetFollowId: 'c',
      position: 'after',
    });
  });

  it('유효하지 않은 to 인덱스면 null을 반환한다', () => {
    // Given - 범위 밖 인덱스
    const items = createItems(['a', 'b']);

    // When
    const result = getFriendReorderInstruction(items, 0, 5);

    // Then
    expect(result).toBeNull();
  });

  it('아이템이 하나뿐이면 null을 반환한다', () => {
    // Given - 단일 아이템
    const items = createItems(['a']);

    // When
    const result = getFriendReorderInstruction(items, 0, 0);

    // Then
    expect(result).toBeNull();
  });
});
