import { sumBy } from 'es-toolkit';
import { z } from 'zod';

import {
  type TodoImportTarget,
  TodoImportTargetPolicy,
  todoImportTargetSchema,
} from './todo-import-target.model';

const countSchema = z.int().nonnegative();

// 고른 곳 하나에 넣을 일정 수와 실제로 들어가는 수
const todoImportPlacementSchema = z.object({
  target: todoImportTargetSchema,
  // 이곳을 고른 캘린더의 일정을 모두 더한 수
  importCount: countSchema,
  // 가져오기 전에 이곳에 더 넣을 수 있는 할 일 수
  roomLeft: countSchema,
  // 남은 자리만큼 실제로 들어가는 수
  placedCount: countSchema,
  skippedCount: countSchema,
  // 가져온 뒤에도 남는 자리
  remainingCount: countSchema,
});
export type TodoImportPlacement = z.infer<typeof todoImportPlacementSchema>;

// 넘치거나(overflow) 가득 찬(full) 곳은 일정을 건너뛴다
type TodoImportPlacementStatus = 'fits' | 'fillsUp' | 'overflow' | 'full';

interface TodoImportPlacementSummary {
  totalCount: number;
  placedCount: number;
  // 일정이 들어가는 아이두 카테고리 수
  destinationCount: number;
}

// 넘쳐도 가져오기는 막지 않는다. 서버가 가까운 날짜부터 넣고 나머지를 건너뛴다
export function createTodoImportPlacement(
  target: TodoImportTarget,
  importCount: number,
  roomLeft: number,
): TodoImportPlacement {
  const placedCount = Math.min(importCount, roomLeft);

  return {
    target,
    importCount,
    roomLeft,
    placedCount,
    skippedCount: importCount - placedCount,
    remainingCount: roomLeft - placedCount,
  };
}

export const TodoImportPlacementPolicy = {
  getStatus(placement: TodoImportPlacement): TodoImportPlacementStatus {
    if (placement.roomLeft === 0) {
      return 'full';
    }
    if (0 < placement.skippedCount) {
      return 'overflow';
    }
    return placement.remainingCount === 0 ? 'fillsUp' : 'fits';
  },

  // 이 넣을 곳의 자리 계산. 이름이 같은 새 카테고리는 같은 곳이다
  findByTarget(
    placements: readonly TodoImportPlacement[],
    target: TodoImportTarget,
  ): TodoImportPlacement | null {
    return (
      placements.find((placement) =>
        TodoImportTargetPolicy.isSameTarget(placement.target, target),
      ) ?? null
    );
  },

  // 모두 몇 개를 몇 곳에 넣는지, 자리가 모자라 실제로 몇 개만 들어가는지
  getSummary(placements: readonly TodoImportPlacement[]): TodoImportPlacementSummary {
    return {
      totalCount: sumBy(placements, ({ importCount }) => importCount),
      placedCount: sumBy(placements, ({ placedCount }) => placedCount),
      destinationCount: placements.length,
    };
  },
};
