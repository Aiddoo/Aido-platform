import { getReorderInstruction } from './draggable-reorder';

const createItems = (ids: number[]) => ids.map((id) => ({ id }));

describe('getReorderInstruction', () => {
  it('from과 to가 같으면 null을 반환해야 한다', () => {
    const result = getReorderInstruction(createItems([10, 20, 30]), 1, 1);

    expect(result).toBeNull();
  });

  it('첫 번째 위치로 이동하면 before 규칙을 반환해야 한다', () => {
    const result = getReorderInstruction(createItems([20, 10, 30]), 1, 0);

    expect(result).toEqual({
      movedItemId: 20,
      targetId: 10,
      position: 'before',
    });
  });

  it('중간/마지막 위치로 이동하면 after 규칙을 반환해야 한다', () => {
    const result = getReorderInstruction(createItems([10, 30, 20]), 1, 2);

    expect(result).toEqual({
      movedItemId: 20,
      targetId: 30,
      position: 'after',
    });
  });

  it('to 인덱스가 유효하지 않으면 null을 반환해야 한다', () => {
    const result = getReorderInstruction(createItems([10, 20, 30]), 0, 5);

    expect(result).toBeNull();
  });

  it('첫 번째 이동인데 타깃이 없으면 null을 반환해야 한다', () => {
    const result = getReorderInstruction(createItems([10]), 0, 0);

    expect(result).toBeNull();
  });
});
