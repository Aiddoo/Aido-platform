import { createMemoryObservableSyncStorage } from '@src/shared/__tests__';
import { toInstant } from '@src/shared/date/instant';

import { createActivationProgressRepository } from './activation-progress.repository';
import { ActivationService } from './activation.service';

const newUser = { id: 'new-user', createdAt: toInstant('2026-08-01T00:00:00.000Z') };

function createService(): ActivationService {
  return new ActivationService(
    createActivationProgressRepository(createMemoryObservableSyncStorage()),
  );
}

describe('ActivationService', () => {
  it('가입 7일 안에 만들고 끝내면 활성화 이벤트를 한 번 돌려준다', () => {
    // Given
    const service = createService();
    service.recordTodoCreated({ user: newUser, now: toInstant('2026-08-02T10:00:00.000Z') });

    // When
    const first = service.recordTodoCompletion({
      user: newUser,
      isCompleted: true,
      now: toInstant('2026-08-03T12:00:00.000Z'),
    });
    const duplicate = service.recordTodoCompletion({
      user: newUser,
      isCompleted: true,
      now: toInstant('2026-08-04T12:00:00.000Z'),
    });

    // Then
    expect(first.event).toEqual({ days_since_signup: 2 });
    expect(duplicate.event).toBeNull();
  });

  it('가입 7일이 지난 계정과 완료 해제는 진행 상태를 바꾸지 않는다', () => {
    // Given
    const service = createService();
    const existingUser = { id: 'existing-user', createdAt: toInstant('2026-07-01T00:00:00.000Z') };

    // When
    const existingCreate = service.recordTodoCreated({
      user: existingUser,
      now: toInstant('2026-08-02T10:00:00.000Z'),
    });
    const uncomplete = service.recordTodoCompletion({
      user: newUser,
      isCompleted: false,
      now: toInstant('2026-08-02T12:00:00.000Z'),
    });

    // Then
    expect(existingCreate).toBeNull();
    expect(uncomplete.event).toBeNull();
  });

  it('가입 7일이 되는 순간부터 끝내도 활성화로 세지 않는다', () => {
    // Given
    const service = createService();
    service.recordTodoCreated({ user: newUser, now: toInstant('2026-08-02T10:00:00.000Z') });

    // When
    const result = service.recordTodoCompletion({
      user: newUser,
      isCompleted: true,
      now: toInstant('2026-08-08T00:00:00.000Z'),
    });

    // Then
    expect(result.event).toBeNull();
  });
});
