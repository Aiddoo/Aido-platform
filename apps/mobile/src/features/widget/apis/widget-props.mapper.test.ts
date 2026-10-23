import { buildWidgetSnapshot } from '../__tests__/widget-snapshot.factory';
import { toWidgetProps } from './widget-props.mapper';

describe('위젯 표시 데이터 변환', () => {
  it('양 플랫폼에 같은 표시 정보와 콜드 실행 계약을 전달한다', () => {
    // Given
    const snapshot = buildWidgetSnapshot();
    // When
    const props = toWidgetProps(snapshot, 'data');
    // Then
    expect(props.date).toBe(snapshot.date);
    expect(props.opensApp).toBe(true);
    expect(props.topTodos).toEqual(
      snapshot.topTodos.map((todo) => ({
        id: todo.id,
        title: todo.title,
        completed: todo.completed,
        color: todo.categoryColor,
        destination: `aido://todo/${todo.id}`,
      })),
    );
  });

  it('이전 compact streak가 없는 스냅샷도 표시한다', () => {
    // Given
    const snapshot = buildWidgetSnapshot();
    delete snapshot.strings.compactStreakLabel;

    // When
    const props = toWidgetProps(snapshot, 'data');
    // Then
    expect(props.compactStreakLabel).toBe(snapshot.strings.streakLabel);
    expect(props.weekDays).toBeUndefined();
    expect(props.addTodoLabel).toBe(snapshot.strings.emptyCta);
  });

  it('날짜가 지난 타임라인은 새로운 날 문구를 표시한다', () => {
    // Given
    const snapshot = buildWidgetSnapshot();
    // When
    const props = toWidgetProps(snapshot, 'stale');
    // Then
    expect(props.stateTitle).toBe(snapshot.strings.staleTitle);
    expect(props.stateCta).toBe(snapshot.strings.staleCta);
  });

  it('손상된 카테고리 색상을 native renderer에 넘기지 않는다', () => {
    // Given
    const snapshot = buildWidgetSnapshot({
      topTodos: [{ id: 1, title: 'Todo', completed: false, categoryColor: 'invalid' }],
    });

    // When
    const props = toWidgetProps(snapshot, 'data');
    // Then
    expect(props.topTodos[0]?.color).toBe('#FF6B43');
  });

  it('개발 앱도 올바른 스킴으로 오늘 보기와 작성 화면을 연다', () => {
    // Given
    const snapshot = buildWidgetSnapshot();
    // When
    const props = toWidgetProps(snapshot, 'data', 'aido-dev');
    // Then
    expect(props.openAppUrl).toBe('aido-dev://feed?date=today');
    expect(props.addTodoUrl).toBe('aido-dev://feed?date=today&action=add-todo');
    expect(props.topTodos[0]?.destination).toBe('aido-dev://todo/1');
  });
});
