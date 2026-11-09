import { z } from 'zod';

import {
  createDraftKey,
  DRAFT_TTL_MS,
  type DraftEntry,
  isDraftOwnedBy,
  resolveDraftRestore,
} from './draft.model';

const contentSchema = z.object({ content: z.string() });
const NOW = Date.UTC(2026, 9, 23, 12);

function createEntry(overrides: Partial<DraftEntry> = {}): DraftEntry {
  return {
    value: { content: '작성 중' },
    savedAt: NOW - 1000,
    sourceUpdatedAt: null,
    ...overrides,
  };
}

describe('createDraftKey', () => {
  it('사용자·기능·대상을 순서대로 이어 사용자마다 다른 키를 만든다', () => {
    // Given
    const first = createDraftKey({
      ownerId: 'user-1',
      scope: 'todo-comment',
      target: [42, 'reply', 'comment-1'],
      schema: contentSchema,
    });

    // When
    const anotherUser = createDraftKey({
      ownerId: 'user-2',
      scope: 'todo-comment',
      target: [42, 'reply', 'comment-1'],
      schema: contentSchema,
    });

    // Then
    expect(first.id).toBe('user-1:todo-comment:42:reply:comment-1');
    expect(anotherUser.id).not.toBe(first.id);
  });

  it('구분자가 들어간 식별자도 다른 대상과 충돌하지 않는다', () => {
    // Given
    const colonInTarget = createDraftKey({
      ownerId: 'user-1',
      scope: 'memo',
      target: ['a:b'],
      schema: contentSchema,
    });

    // When
    const splitTarget = createDraftKey({
      ownerId: 'user-1',
      scope: 'memo',
      target: ['a', 'b'],
      schema: contentSchema,
    });

    // Then
    expect(colonInTarget.id).not.toBe(splitTarget.id);
  });
});

describe('resolveDraftRestore', () => {
  it('저장된 초안이 없으면 빈 상태다', () => {
    // When
    const result = resolveDraftRestore(null, { schema: contentSchema, now: NOW });

    // Then
    expect(result).toEqual({ status: 'empty' });
  });

  it('보존 기간 안의 초안을 복원한다', () => {
    // Given
    const entry = createEntry();

    // When
    const result = resolveDraftRestore(entry, { schema: contentSchema, now: NOW });

    // Then
    expect(result).toEqual({ status: 'restored', value: { content: '작성 중' } });
  });

  it('보존 기간이 지난 초안은 만료로 버린다', () => {
    // Given
    const entry = createEntry({ savedAt: NOW - DRAFT_TTL_MS });

    // When
    const result = resolveDraftRestore(entry, { schema: contentSchema, now: NOW });

    // Then
    expect(result).toEqual({ status: 'discarded', reason: 'expired' });
  });

  it('초안을 쓴 뒤 서버 원본이 바뀌었으면 낡은 초안으로 버린다', () => {
    // Given
    const entry = createEntry({ sourceUpdatedAt: NOW - 5000 });

    // When
    const result = resolveDraftRestore(entry, {
      schema: contentSchema,
      now: NOW,
      sourceUpdatedAt: NOW - 2000,
    });

    // Then
    expect(result).toEqual({ status: 'discarded', reason: 'outdated' });
  });

  it('서버 원본이 초안의 기준과 같으면 복원한다', () => {
    // Given
    const entry = createEntry({ sourceUpdatedAt: NOW - 5000 });

    // When
    const result = resolveDraftRestore(entry, {
      schema: contentSchema,
      now: NOW,
      sourceUpdatedAt: NOW - 5000,
    });

    // Then
    expect(result.status).toBe('restored');
  });

  it('모양이 바뀐 옛 초안은 복원하지 않는다', () => {
    // Given
    const entry = createEntry({ value: { body: '이전 형식' } });

    // When
    const result = resolveDraftRestore(entry, { schema: contentSchema, now: NOW });

    // Then
    expect(result).toEqual({ status: 'discarded', reason: 'invalid' });
  });
});

describe('isDraftOwnedBy', () => {
  const schema = z.object({ content: z.string() });

  it('키를 만든 사용자만 소유자로 판정한다', () => {
    // Given
    const { id } = createDraftKey({ ownerId: 'user-1', scope: 'memo', target: [7], schema });

    // When
    const owner = isDraftOwnedBy(id, 'user-1');
    const other = isDraftOwnedBy(id, 'user-2');

    // Then
    expect(owner).toBe(true);
    expect(other).toBe(false);
  });

  it('소유자 id가 다른 사용자 id의 접두사여도 구분한다', () => {
    // Given
    const { id } = createDraftKey({ ownerId: 'user-10', scope: 'memo', target: [7], schema });

    // When
    const result = isDraftOwnedBy(id, 'user-1');

    // Then
    expect(result).toBe(false);
  });

  it('구분자가 들어간 소유자 id도 인코딩된 구간 그대로 비교한다', () => {
    // Given
    const { id } = createDraftKey({ ownerId: 'a:b', scope: 'memo', target: [7], schema });

    // When
    const exact = isDraftOwnedBy(id, 'a:b');
    const prefix = isDraftOwnedBy(id, 'a');

    // Then
    expect(exact).toBe(true);
    expect(prefix).toBe(false);
  });
});
