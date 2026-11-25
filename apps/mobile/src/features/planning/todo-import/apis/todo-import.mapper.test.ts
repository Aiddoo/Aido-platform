import { dateKeySchema } from '@src/shared/date/date-key';

import {
  createTodoImportCollection,
  createTodoImportDto,
  createTodoImportSelection,
  PERSONAL_COLLECTION_KEY,
} from '../__tests__/todo-import.fixtures';
import type { TodoImportFormValues } from '../schemas/todo-import-form.schema';
import {
  toStartTodoImportRequest,
  toTodoImport,
  toTodoImportSelection,
} from './todo-import.mapper';

const DEFAULT_TARGET = { kind: 'EXISTING_CATEGORY', categoryId: 3 } as const;
const SCHOOL_TARGET = { kind: 'NEW_CATEGORY', name: '학교', color: '#339AF0' } as const;

function createFormValues(overrides: Partial<TodoImportFormValues> = {}): TodoImportFormValues {
  return {
    range: {
      startDate: dateKeySchema.parse('2026-11-24'),
      endDate: dateKeySchema.parse('2026-12-23'),
    },
    collectionKeys: null,
    collections: [],
    targets: {},
    categoryMode: 'single',
    singleTarget: null,
    timeMode: 'TIME',
    visibility: 'PRIVATE',
    ...overrides,
  };
}

describe('toTodoImport', () => {
  it('서버 가져오기를 날짜 key·순간 모델로 바꾸고 시간대를 그대로 둔다', () => {
    // Given
    const dto = createTodoImportDto({
      status: 'COMPLETED',
      timezone: 'America/Los_Angeles',
      firstDate: '2026-11-25',
      undoableUntil: '2026-12-01T01:00:00.000Z',
      completedAt: '2026-11-24T01:00:00.000Z',
    });

    // When
    const todoImport = toTodoImport(dto);

    // Then
    expect(todoImport).toMatchObject({
      status: 'COMPLETED',
      timezone: 'America/Los_Angeles',
      firstDate: '2026-11-25',
      undoableUntil: '2026-12-01T01:00:00.000Z',
    });
  });
});

describe('toStartTodoImportRequest', () => {
  it('출처를 붙여 계약 모양으로 보낸다', () => {
    // When
    const request = toStartTodoImportRequest(createTodoImportSelection());

    // Then
    expect(request).toMatchObject({
      source: 'DEVICE_CALENDAR',
      collections: [
        { collectionKey: PERSONAL_COLLECTION_KEY, targetKey: 'new-0', expectedItemCount: 2 },
      ],
    });
  });

  it('어느 캘린더도 쓰지 않는 대상은 보내기 전에 막는다', () => {
    // Given
    const selection = createTodoImportSelection({
      targets: [
        { targetKey: 'new-0', kind: 'NEW_CATEGORY', name: '개인', color: '#FF6B43' },
        { targetKey: 'unused', kind: 'EXISTING_CATEGORY', categoryId: 3 },
      ],
    });

    // When
    const send = () => toStartTodoImportRequest(selection);

    // Then
    expect(send).toThrow('어느 캘린더도 쓰지 않는 대상이 있습니다');
  });
});

describe('toTodoImportSelection', () => {
  it('같은 곳을 고른 캘린더는 대상 하나를 함께 가리킨다', () => {
    // Given
    const school = createTodoImportCollection({ collectionKey: 'a'.repeat(64), itemCount: 3 });
    const work = createTodoImportCollection({ collectionKey: 'b'.repeat(64), itemCount: 5 });
    const shared = { kind: 'NEW_CATEGORY', name: '가져온 일정', color: '#339AF0' } as const;

    // When
    const selection = toTodoImportSelection(
      createFormValues({
        collections: [school, work],
        categoryMode: 'separate',
        targets: {
          [school.collectionKey]: shared,
          [work.collectionKey]: { ...shared, name: ' 가져온 일정' },
        },
      }),
    );

    // Then
    expect(selection.targets).toEqual([{ ...shared, targetKey: 'new-0' }]);
    expect(selection.collections).toEqual([
      { collectionKey: school.collectionKey, targetKey: 'new-0', expectedItemCount: 3 },
      { collectionKey: work.collectionKey, targetKey: 'new-0', expectedItemCount: 5 },
    ]);
  });

  it('한 곳에 넣으면 모든 캘린더가 고정한 넣을 곳 하나를 가리킨다', () => {
    // Given
    const school = createTodoImportCollection({ collectionKey: 'a'.repeat(64), itemCount: 3 });
    const work = createTodoImportCollection({ collectionKey: 'b'.repeat(64), itemCount: 5 });

    // When
    const selection = toTodoImportSelection(
      createFormValues({
        collections: [school, work],
        targets: { [school.collectionKey]: SCHOOL_TARGET },
        categoryMode: 'single',
        singleTarget: DEFAULT_TARGET,
      }),
    );

    // Then
    expect(selection.targets).toEqual([{ ...DEFAULT_TARGET, targetKey: 'category-3' }]);
    expect(selection.collections).toEqual([
      { collectionKey: school.collectionKey, targetKey: 'category-3', expectedItemCount: 3 },
      { collectionKey: work.collectionKey, targetKey: 'category-3', expectedItemCount: 5 },
    ]);
  });

  it('기존 카테고리는 id로, 새 카테고리는 대상 전체에서의 순번으로 키를 짓는다', () => {
    // Given
    const school = createTodoImportCollection({ collectionKey: 'a'.repeat(64), itemCount: 3 });
    const work = createTodoImportCollection({ collectionKey: 'b'.repeat(64), itemCount: 5 });

    // When
    const selection = toTodoImportSelection(
      createFormValues({
        collections: [school, work],
        categoryMode: 'separate',
        targets: { [school.collectionKey]: DEFAULT_TARGET, [work.collectionKey]: SCHOOL_TARGET },
      }),
    );

    // Then
    expect(selection.targets).toEqual([
      { ...DEFAULT_TARGET, targetKey: 'category-3' },
      { ...SCHOOL_TARGET, targetKey: 'new-1' },
    ]);
    expect(selection.collections).toEqual([
      { collectionKey: school.collectionKey, targetKey: 'category-3', expectedItemCount: 3 },
      { collectionKey: work.collectionKey, targetKey: 'new-1', expectedItemCount: 5 },
    ]);
  });

  it('넣을 곳이 없는 캘린더는 요청에서 빠진다', () => {
    // Given
    const school = createTodoImportCollection({ collectionKey: 'a'.repeat(64), itemCount: 3 });
    const work = createTodoImportCollection({ collectionKey: 'b'.repeat(64), itemCount: 5 });

    // When
    const selection = toTodoImportSelection(
      createFormValues({
        collections: [school, work],
        categoryMode: 'separate',
        singleTarget: null,
        targets: { [school.collectionKey]: SCHOOL_TARGET },
      }),
    );

    // Then
    expect(selection.targets).toEqual([{ ...SCHOOL_TARGET, targetKey: 'new-0' }]);
    expect(selection.collections).toEqual([
      { collectionKey: school.collectionKey, targetKey: 'new-0', expectedItemCount: 3 },
    ]);
  });
});
