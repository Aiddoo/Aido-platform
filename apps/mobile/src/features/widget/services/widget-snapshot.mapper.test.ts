import {
  toLoggedOutWidgetSnapshot,
  toWidgetSnapshot,
  type WidgetSnapshotContext,
  type WidgetSummaryInput,
  type WidgetTranslateFn,
} from './widget-snapshot.mapper';

const fakeT: WidgetTranslateFn = (key, params) =>
  params ? `${key}(${JSON.stringify(params)})` : key;

function buildContext(overrides: Partial<WidgetSnapshotContext> = {}): WidgetSnapshotContext {
  return {
    t: fakeT,
    locale: 'ko',
    now: new Date('2026-07-12T09:00:00.000Z'),
    ...overrides,
  };
}

function buildSummary(overrides: Partial<WidgetSummaryInput> = {}): WidgetSummaryInput {
  return {
    date: '2026-07-12',
    totalTodos: 5,
    completedTodos: 3,
    completionRate: 60,
    isComplete: false,
    currentStreak: 12,
    topTodos: [
      { id: 1, title: '운동하기', completed: true, categoryColor: '#B3E5C1' },
      { id: 2, title: '회의 자료 준비', completed: false, categoryColor: '#FFB3B3' },
    ],
    ...overrides,
  };
}

describe('toWidgetSnapshot', () => {
  it('요약을 data 상태 스냅샷으로 변환한다', () => {
    // Given
    const summary = buildSummary();

    // When
    const snapshot = toWidgetSnapshot(summary, buildContext());

    // Then
    expect(snapshot.version).toBe(1);
    expect(snapshot.state).toBe('data');
    expect(snapshot.date).toBe('2026-07-12');
    expect(snapshot.updatedAtIso).toBe('2026-07-12T09:00:00.000Z');
    expect(snapshot.totalTodos).toBe(5);
    expect(snapshot.completedTodos).toBe(3);
    expect(snapshot.currentStreak).toBe(12);
    expect(snapshot.topTodos).toHaveLength(2);
    expect(snapshot.locale).toBe('ko');
  });

  it('할 일이 없으면 empty 상태다', () => {
    // Given
    const summary = buildSummary({ totalTodos: 0, completedTodos: 0, topTodos: [] });

    // When
    const snapshot = toWidgetSnapshot(summary, buildContext());

    // Then
    expect(snapshot.state).toBe('empty');
  });

  it('문자열을 t로 구워 담는다 (카운트·퍼센트·스트릭 보간)', () => {
    // Given
    const summary = buildSummary();

    // When
    const snapshot = toWidgetSnapshot(summary, buildContext());

    // Then
    expect(snapshot.strings.progressTitle).toBe('widget:progress.title');
    expect(snapshot.strings.progressLabel).toBe('widget:progress.label({"completed":3,"total":5})');
    expect(snapshot.strings.percentLabel).toBe('widget:progress.percent({"rate":60})');
    expect(snapshot.strings.streakLabel).toBe('widget:progress.streak({"count":12})');
  });

  it('완료율은 반올림해 보간한다', () => {
    // Given
    const summary = buildSummary({ completionRate: 33.333 });

    // When
    const snapshot = toWidgetSnapshot(summary, buildContext());

    // Then
    expect(snapshot.strings.percentLabel).toBe('widget:progress.percent({"rate":33})');
  });

  it('표시 한도(10개) 초과분은 절단하고 moreLabel에 남은 개수를 굽는다', () => {
    // Given - 총 13개 중 topTodos 10개 도착
    const topTodos = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      title: `할 일 ${i + 1}`,
      completed: false,
      categoryColor: '#FFB3B3',
    }));
    const summary = buildSummary({ totalTodos: 13, topTodos });

    // When
    const snapshot = toWidgetSnapshot(summary, buildContext());

    // Then
    expect(snapshot.topTodos).toHaveLength(10);
    expect(snapshot.strings.moreLabel).toBe('widget:list.more({"count":3})');
  });

  it('모든 할 일이 목록에 담기면 moreLabel은 빈 문자열이다', () => {
    // Given - 총 2개, topTodos에 2개 전부 포함
    const summary = buildSummary({ totalTodos: 2, completedTodos: 1 });

    // When
    const snapshot = toWidgetSnapshot(summary, buildContext());

    // Then
    expect(snapshot.strings.moreLabel).toBe('');
  });
});

describe('toLoggedOutWidgetSnapshot', () => {
  it('비로그인 스냅샷을 만든다 (카운트 0, loggedOut 상태)', () => {
    // When
    const snapshot = toLoggedOutWidgetSnapshot('2026-07-12', buildContext({ locale: 'en' }));

    // Then
    expect(snapshot.state).toBe('loggedOut');
    expect(snapshot.date).toBe('2026-07-12');
    expect(snapshot.totalTodos).toBe(0);
    expect(snapshot.topTodos).toEqual([]);
    expect(snapshot.locale).toBe('en');
    expect(snapshot.strings.loggedOutTitle).toBe('widget:state.loggedOutTitle');
  });
});
