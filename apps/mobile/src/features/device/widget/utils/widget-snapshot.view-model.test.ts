import { createDateKey } from '@src/testing/date-key';

import {
  createWidgetSnapshotContext,
  createWidgetSummary,
  echoTranslate,
} from '../__tests__/widget-snapshot.fixtures';
import {
  getWidgetDayState,
  toWidgetSnapshotStrings,
  toWidgetWeek,
} from './widget-snapshot.view-model';

describe('toWidgetWeek', () => {
  it('주간 발자국은 할 일이 있고 모두 완료한 날에만 표시한다', () => {
    // Given
    const summary = createWidgetSummary({ date: createDateKey('2026-07-15'), isComplete: false });
    const context = createWidgetSnapshotContext({
      weekCompletions: [
        { date: createDateKey('2026-07-12'), totalTodos: 0, isComplete: true },
        { date: createDateKey('2026-07-13'), totalTodos: 2, isComplete: true },
        { date: createDateKey('2026-07-14'), totalTodos: 3, isComplete: false },
        { date: createDateKey('2026-07-15'), totalTodos: 2, isComplete: true },
      ],
    });

    // When
    const week = toWidgetWeek(summary, context);

    // Then
    expect(week.days.map((day) => day.date)).toEqual([
      '2026-07-12',
      '2026-07-13',
      '2026-07-14',
      '2026-07-15',
      '2026-07-16',
      '2026-07-17',
      '2026-07-18',
    ]);
    expect(week.days.filter((day) => day.isComplete).map((day) => day.date)).toEqual([
      '2026-07-13',
    ]);
    expect(week.days[0]?.weekdayLabel).toBe('일');
    expect(week.days.map((day) => day.dayLabel)).toEqual([
      '12',
      '13',
      '14',
      '15',
      '16',
      '17',
      '18',
    ]);
    expect(week.rangeLabel).toBe('07.12 ~ 07.18');
    expect(week.days[3]?.hasTodos).toBe(true);
  });

  it('주간 조회가 실패해도 오늘 요약과 달력 날짜를 표시한다', () => {
    // Given
    const summary = createWidgetSummary({
      date: createDateKey('2026-12-31'),
      totalTodos: 2,
      isComplete: true,
    });

    // When
    const week = toWidgetWeek(summary, createWidgetSnapshotContext({ locale: 'en' }));

    // Then
    expect(week.days[0]?.date).toBe('2026-12-27');
    expect(week.days[6]?.date).toBe('2027-01-02');
    expect(week.days[0]?.weekdayLabel).toBe('Sun');
    expect(week.days.filter((day) => day.isComplete).map((day) => day.date)).toEqual([
      '2026-12-31',
    ]);
    expect(week.rangeLabel).toBe('12.27 – 01.02');
  });

  it('월을 걸친 주는 수요일이 속한 달과 주차를 앱 달력과 같은 글자로 제목에 쓴다', () => {
    // Given
    const summary = createWidgetSummary({ date: createDateKey('2026-10-01') });

    // When
    const week = toWidgetWeek(summary, createWidgetSnapshotContext());

    // Then
    expect(week.days[0]?.date).toBe('2026-09-27');
    // 9월 27일~10월 3일 주의 수요일은 9월 30일이다
    expect(week.title).toBe('9월 5주차');
  });
});

describe('toWidgetSnapshotStrings', () => {
  it('문자열을 t로 구워 담는다 (카운트·퍼센트·스트릭 보간)', () => {
    // When
    const strings = toWidgetSnapshotStrings(echoTranslate, createWidgetSummary());

    // Then
    expect(strings.progressTitle).toBe('widget:progress.title');
    expect(strings.percentLabel).toBe('widget:progress.percent({"rate":60})');
    expect(strings.streakLabel).toBe('widget:progress.streak({"count":12})');
    expect(strings.compactStreakLabel).toBe('widget:progress.compactStreak({"count":12})');
  });

  it('완료율은 반올림해 보간한다', () => {
    // Given
    const summary = createWidgetSummary({ completionRate: 33.333 });

    // When
    const strings = toWidgetSnapshotStrings(echoTranslate, summary);

    // Then
    expect(strings.percentLabel).toBe('widget:progress.percent({"rate":33})');
  });

  it('moreLabelTemplate은 {count} 플레이스홀더를 남긴 채 굽는다 (표시 행 수는 위젯만 안다)', () => {
    // When
    const strings = toWidgetSnapshotStrings(echoTranslate, createWidgetSummary());

    // Then
    // 렌더 시점에 위젯이 {count}를 실제 초과분으로 치환한다
    expect(strings.moreLabelTemplate).toBe('widget:list.more({"overflow":"{count}"})');
  });
});

describe('getWidgetDayState', () => {
  it.each([
    [0, 'empty'],
    [1, 'data'],
  ] as const)('할 일 %i개면 %s 상태다', (totalTodos, expected) => {
    expect(getWidgetDayState({ totalTodos })).toBe(expected);
  });
});
