import { buildWidgetSnapshot } from '../__tests__/widget-snapshot.factory';
import { toWidgetProps } from './widget-props.mapper';

describe('toWidgetProps', () => {
  it('양 플랫폼에 같은 표시 정보와 콜드 실행 계약을 전달한다', () => {
    const snapshot = buildWidgetSnapshot();
    const props = toWidgetProps(snapshot, 'data');

    expect(props.date).toBe(snapshot.date);
    expect(props.opensApp).toBe(true);
    expect(props.topTodos).toEqual(
      snapshot.topTodos.map((todo) => ({
        title: todo.title,
        completed: todo.completed,
        color: todo.categoryColor,
      })),
    );
  });

  it('이전 compact streak가 없는 스냅샷도 표시한다', () => {
    const snapshot = buildWidgetSnapshot();
    delete snapshot.strings.compactStreakLabel;

    expect(toWidgetProps(snapshot, 'data').compactStreakLabel).toBe(snapshot.strings.streakLabel);
  });

  it('날짜가 지난 타임라인은 새로운 날 문구를 표시한다', () => {
    const snapshot = buildWidgetSnapshot();
    const props = toWidgetProps(snapshot, 'stale');

    expect(props.stateTitle).toBe(snapshot.strings.staleTitle);
    expect(props.stateCta).toBe(snapshot.strings.staleCta);
  });

  it('손상된 카테고리 색상을 native renderer에 넘기지 않는다', () => {
    const snapshot = buildWidgetSnapshot({
      topTodos: [{ id: 1, title: 'Todo', completed: false, categoryColor: 'invalid' }],
    });

    expect(toWidgetProps(snapshot, 'data').topTodos[0]?.color).toBe('#FF6B43');
  });
});
