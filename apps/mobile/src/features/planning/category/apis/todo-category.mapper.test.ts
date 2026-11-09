import {
  todoCategoryListResponseSchema,
  todoCategorySchema as todoCategoryDtoSchema,
} from '@aido/api';

import {
  createTodoCategoryDto,
  createTodoCategoryListDto,
  createTodoCategoryWithCountDto,
} from '../__tests__/todo-category.fixtures';
import { todoCategoriesResultSchema, todoCategorySchema } from '../domains/todo-category.model';
import {
  toTodoCategory,
  toTodoCategoryWithCount,
  toTodoCategoryWithCounts,
} from './todo-category.mapper';

describe('toTodoCategoryWithCount', () => {
  it('sortOrder, todoCount 매핑', () => {
    // Given
    const dto = createTodoCategoryWithCountDto({ sortOrder: 2, todoCount: 10 });

    // When
    const result = toTodoCategoryWithCount(dto);

    // Then
    expect(result.id).toBe(dto.id);
    expect(result.name).toBe(dto.name);
    expect(result.color).toBe(dto.color);
    expect(result.sortOrder).toBe(2);
    expect(result.todoCount).toBe(10);
  });
});

describe('toTodoCategoryWithCounts', () => {
  it('배열 변환', () => {
    // Given
    const dtos = [
      createTodoCategoryWithCountDto({ id: 1 }),
      createTodoCategoryWithCountDto({ id: 2 }),
    ];

    // When
    const result = toTodoCategoryWithCounts(dtos);

    // Then
    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe(1);
    expect(result[1]?.id).toBe(2);
  });

  it('빈 배열 → 빈 배열', () => {
    // When
    const result = toTodoCategoryWithCounts([]);

    // Then
    expect(result).toEqual([]);
  });
});

describe('toTodoCategory', () => {
  it('sortOrder 매핑 (todoCount 제외)', () => {
    // Given
    const dto = createTodoCategoryDto();

    // When
    const result = toTodoCategory(dto);

    // Then
    expect(result).toEqual({ id: 1, name: '기본', color: '#3B82F6', sortOrder: 0 });
    expect(result).not.toHaveProperty('todoCount');
    expect(result).not.toHaveProperty('userId');
    expect(result).not.toHaveProperty('createdAt');
  });
});

describe('계약 응답과 카테고리 모델', () => {
  it('계약을 통과한 카테고리 목록을 매핑하면 목록 모델 스키마를 통과한다', () => {
    // Given
    const dto = todoCategoryListResponseSchema.parse(createTodoCategoryListDto());

    // When
    const result = { categories: toTodoCategoryWithCounts(dto.items) };

    // Then
    expect(todoCategoriesResultSchema.parse(result)).toEqual(result);
  });

  it('계약을 통과한 카테고리를 매핑하면 카테고리 모델 스키마를 통과한다', () => {
    // Given
    const dto = todoCategoryDtoSchema.parse(createTodoCategoryDto({ id: 2, sortOrder: 1 }));

    // When
    const result = toTodoCategory(dto);

    // Then
    expect(todoCategorySchema.parse(result)).toEqual(result);
  });
});
