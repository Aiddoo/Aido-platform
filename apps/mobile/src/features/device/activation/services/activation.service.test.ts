import { toInstant } from '@src/shared/date/instant';
import { readStoredValue } from '@src/shared/storage/define-stored-value';
import { createMemoryObservableSyncStorage } from '@src/testing/core';

import { activationProgressStoredValue } from '../schemas/activation-progress-storage.schema';
import { ActivationService } from './activation.service';

const newUser = { id: 'new-user', createdAt: toInstant('2026-08-01T00:00:00.000Z') };

function createService(storage = createMemoryObservableSyncStorage()) {
  return { storage, service: new ActivationService(storage) };
}

describe('ActivationService', () => {
  it('가입 7일 안에 만들고 끝내면 활성화를 한 번만 돌려준다', () => {
    // Given
    const { service } = createService();
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
    expect(first).toEqual({ status: 'activated', daysSinceSignup: 2 });
    expect(duplicate).toEqual({ status: 'skipped' });
  });

  it('할 일을 만든 시각은 처음 한 번만 남긴다', () => {
    // Given
    const { storage, service } = createService();

    // When
    service.recordTodoCreated({ user: newUser, now: toInstant('2026-08-02T10:00:00.000Z') });
    service.recordTodoCreated({ user: newUser, now: toInstant('2026-08-03T10:00:00.000Z') });

    // Then
    expect(readStoredValue(storage, activationProgressStoredValue, newUser.id)).toEqual({
      todoCreatedAt: '2026-08-02T10:00:00.000Z',
      activatedAt: null,
    });
  });

  it('가입 7일이 지난 계정, 완료 해제, 만들기 전 완료는 진행을 바꾸지 않는다', () => {
    // Given
    const { storage, service } = createService();
    const existingUser = { id: 'existing-user', createdAt: toInstant('2026-07-01T00:00:00.000Z') };

    // When
    service.recordTodoCreated({ user: existingUser, now: toInstant('2026-08-02T10:00:00.000Z') });
    const uncomplete = service.recordTodoCompletion({
      user: newUser,
      isCompleted: false,
      now: toInstant('2026-08-02T12:00:00.000Z'),
    });
    const beforeCreate = service.recordTodoCompletion({
      user: newUser,
      isCompleted: true,
      now: toInstant('2026-08-02T12:00:00.000Z'),
    });

    // Then
    expect([uncomplete, beforeCreate]).toEqual([{ status: 'skipped' }, { status: 'skipped' }]);
    expect(storage.keys()).toEqual([]);
  });

  it('가입 7일이 되는 순간부터 끝내도 활성화로 세지 않는다', () => {
    // Given
    const { service } = createService();
    service.recordTodoCreated({ user: newUser, now: toInstant('2026-08-02T10:00:00.000Z') });

    // When
    const result = service.recordTodoCompletion({
      user: newUser,
      isCompleted: true,
      now: toInstant('2026-08-08T00:00:00.000Z'),
    });

    // Then
    expect(result).toEqual({ status: 'skipped' });
  });

  it('활성화를 남기지 못하면 세지 않아 다음 완료에서 다시 센다', () => {
    // Given
    const { storage, service } = createService();
    service.recordTodoCreated({ user: newUser, now: toInstant('2026-08-02T10:00:00.000Z') });
    storage.set.mockImplementationOnce(() => {
      throw new Error('storage unavailable');
    });

    // When
    const failed = service.recordTodoCompletion({
      user: newUser,
      isCompleted: true,
      now: toInstant('2026-08-03T12:00:00.000Z'),
    });
    const retried = service.recordTodoCompletion({
      user: newUser,
      isCompleted: true,
      now: toInstant('2026-08-04T12:00:00.000Z'),
    });

    // Then
    expect(failed).toEqual({ status: 'skipped' });
    expect(retried).toEqual({ status: 'activated', daysSinceSignup: 3 });
  });
});
