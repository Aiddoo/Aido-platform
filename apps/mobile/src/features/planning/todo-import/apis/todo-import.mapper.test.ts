import {
  createTodoImportDto,
  createTodoImportSelection,
  PERSONAL_COLLECTION_KEY,
} from '../__tests__/todo-import.fixtures';
import { toStartTodoImportRequest, toTodoImport } from './todo-import.mapper';

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
