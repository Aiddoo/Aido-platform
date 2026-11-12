import {
  todoCategoryListResponseSchema,
  todoCategorySchema as todoCategoryDtoSchema,
} from '@aido/api';

import {
  createTodoCategoryDto,
  createTodoCategoryListDto,
} from '../__tests__/todo-category.fixtures';
import { todoCategoriesResultSchema, todoCategorySchema } from '../domains/todo-category.model';
import { toTodoCategory, toTodoCategoryWithCounts } from './todo-category.mapper';

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
