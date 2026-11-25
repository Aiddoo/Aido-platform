import {
  createTodoImportPlacement,
  TodoImportPlacementPolicy,
} from './todo-import-placement.model';

const WORK_TARGET = { kind: 'EXISTING_CATEGORY', categoryId: 7 } as const;
const SCHOOL_TARGET = { kind: 'NEW_CATEGORY', name: '학교', color: '#339AF0' } as const;

describe('createTodoImportPlacement', () => {
  it('남은 자리보다 많으면 남은 자리만큼만 들어가고 나머지는 건너뛴다', () => {
    // When
    const placement = createTodoImportPlacement(WORK_TARGET, 180, 52);

    // Then
    expect(placement).toEqual({
      target: WORK_TARGET,
      importCount: 180,
      roomLeft: 52,
      placedCount: 52,
      skippedCount: 128,
      remainingCount: 0,
    });
  });
});

describe('TodoImportPlacementPolicy', () => {
  describe('getStatus', () => {
    it.each([
      ['넣고도 자리가 남는다', 7, 10, 'fits'],
      ['모두 들어가고 가득 찬다', 10, 10, 'fillsUp'],
      ['자리가 모자라 일부를 건너뛴다', 11, 10, 'overflow'],
      ['이미 가득 차 하나도 들어가지 않는다', 3, 0, 'full'],
    ])('%s', (_case, importCount, roomLeft, expected) => {
      // Given
      const placement = createTodoImportPlacement(WORK_TARGET, importCount, roomLeft);

      // When
      const status = TodoImportPlacementPolicy.getStatus(placement);

      // Then
      expect(status).toBe(expected);
    });
  });

  describe('findByTarget', () => {
    it('이름이 같은 새 카테고리는 같은 곳의 자리 계산이다', () => {
      // Given
      const placements = [createTodoImportPlacement(SCHOOL_TARGET, 4, 300)];

      // When
      const placement = TodoImportPlacementPolicy.findByTarget(placements, {
        ...SCHOOL_TARGET,
        name: ' 학교 ',
      });

      // Then
      expect(placement?.placedCount).toBe(4);
    });

    it('고르지 않은 곳은 없다', () => {
      // Given
      const placements = [createTodoImportPlacement(SCHOOL_TARGET, 4, 300)];

      // When
      const placement = TodoImportPlacementPolicy.findByTarget(placements, WORK_TARGET);

      // Then
      expect(placement).toBeNull();
    });
  });

  describe('getSummary', () => {
    it('넣을 곳마다 실제로 들어가는 수를 더해 건너뛸 수를 알 수 있다', () => {
      // Given
      const placements = [
        createTodoImportPlacement(WORK_TARGET, 180, 52),
        createTodoImportPlacement(SCHOOL_TARGET, 4, 300),
      ];

      // When
      const summary = TodoImportPlacementPolicy.getSummary(placements);

      // Then
      expect(summary).toEqual({ totalCount: 184, placedCount: 56, destinationCount: 2 });
    });
  });
});
