import type { ImportEventRecord } from '@src/core/ports/todo-import-source';

import { PERSONAL_COLLECTION_KEY } from '../__tests__/todo-import.fixtures';
import { toImportItem } from './todo-import-item.mapper';

const CONTEXT = {
  timezone: 'Asia/Seoul',
  timeMode: 'TIME',
  untitledTitle: '제목 없는 일정',
} as const;

function createRecord(overrides: Partial<ImportEventRecord> = {}): ImportEventRecord {
  return {
    collectionKey: PERSONAL_COLLECTION_KEY,
    occurrenceKey: '1'.repeat(64),
    title: '팀 회의',
    time: {
      kind: 'timed',
      startsAt: '2026-11-25T01:00:00.000Z',
      endsAt: '2026-11-25T02:00:00.000Z',
    },
    isCanceled: false,
    ...overrides,
  };
}

describe('toImportItem', () => {
  it('시각 일정은 가져오기 시간대의 시작 날짜·시각이고 끝 날짜가 없다', () => {
    // When
    const item = toImportItem(createRecord(), CONTEXT);

    // Then
    expect(item).toEqual({
      sourceKey: '1'.repeat(64),
      collectionKey: PERSONAL_COLLECTION_KEY,
      title: '팀 회의',
      startDate: '2026-11-25',
      endDate: null,
      localTime: '10:00',
    });
  });

  it('같은 순간도 가져오기 시간대가 다르면 다른 날짜다', () => {
    // Given
    const record = createRecord({
      time: {
        kind: 'timed',
        startsAt: '2026-11-25T01:00:00.000Z',
        endsAt: '2026-11-25T02:00:00.000Z',
      },
    });

    // When
    const item = toImportItem(record, { ...CONTEXT, timezone: 'America/Los_Angeles' });

    // Then
    expect(item).toMatchObject({ startDate: '2026-11-24', localTime: '17:00' });
  });

  it('여러 날 종일 일정은 시간대와 상관없이 기기 날짜 그대로이고 마지막 날을 포함한다', () => {
    // Given
    const record = createRecord({
      title: null,
      time: { kind: 'allDay', startDate: '2026-12-24', endDateExclusive: '2026-12-27' },
    });

    // When
    const item = toImportItem(record, CONTEXT);

    // Then
    expect(item).toMatchObject({
      title: '제목 없는 일정',
      startDate: '2026-12-24',
      endDate: '2026-12-26',
      localTime: null,
    });
  });

  it.each([
    ['취소된 회차', createRecord({ isCanceled: true })],
    [
      '읽을 수 없는 날짜',
      createRecord({
        time: { kind: 'allDay', startDate: '2026-02-30', endDateExclusive: '2026-03-01' },
      }),
    ],
  ])('%s는 가져오지 않는다', (_case, record) => {
    // When
    const item = toImportItem(record, CONTEXT);

    // Then
    expect(item).toBeNull();
  });
});
