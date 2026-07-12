import type { WidgetRenderState, WidgetSnapshot } from '../models/widget-snapshot.model';
import { aidoProgressWidget, aidoTodayListWidget } from '../presentations/ios/aido-widgets';
import type { IosWidgetProps } from '../presentations/ios/ios-widget-props';
import type { WidgetBridge } from './widget-bridge';

function stateStrings(
  snapshot: WidgetSnapshot,
  state: WidgetRenderState,
): { stateTitle: string; stateCta: string } {
  switch (state) {
    case 'loggedOut':
      return {
        stateTitle: snapshot.strings.loggedOutTitle,
        stateCta: snapshot.strings.loggedOutCta,
      };
    case 'stale':
      return { stateTitle: snapshot.strings.staleTitle, stateCta: snapshot.strings.staleCta };
    default:
      return { stateTitle: snapshot.strings.emptyTitle, stateCta: snapshot.strings.emptyCta };
  }
}

function toIosProps(snapshot: WidgetSnapshot, state: WidgetRenderState): IosWidgetProps {
  return {
    state,
    totalTodos: snapshot.totalTodos,
    completedTodos: snapshot.completedTodos,
    completionRate: snapshot.completionRate,
    isComplete: snapshot.isComplete,
    currentStreak: snapshot.currentStreak,
    topTodos: snapshot.topTodos.map((todo) => ({
      title: todo.title,
      completed: todo.completed,
    })),
    progressTitle: snapshot.strings.progressTitle,
    progressLabel: snapshot.strings.progressLabel,
    percentLabel: snapshot.strings.percentLabel,
    streakLabel: snapshot.strings.streakLabel,
    allDoneLabel: snapshot.strings.allDoneLabel,
    moreLabel: snapshot.strings.moreLabel,
    ...stateStrings(snapshot, state),
  };
}

/** 다음 로컬 자정 (기기 타임존 기준) */
function nextLocalMidnight(now: Date): Date {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight;
}

/**
 * iOS 브리지 — expo-widgets 타임라인에 2개 엔트리를 기록한다.
 *
 * 1) 지금: 현재 스냅샷 상태
 * 2) 다음 로컬 자정: stale("새로운 하루") 상태 — WidgetKit이 자정에 자동 전환하므로
 *    백그라운드 작업 없이 날짜가 지난 숫자가 그대로 남는 것을 방지한다.
 */
export function createExpoWidgetsBridge(): WidgetBridge {
  return {
    async writeSnapshot(snapshot: WidgetSnapshot): Promise<void> {
      const now = new Date();
      const currentState: WidgetRenderState = snapshot.state === 'data' ? 'data' : snapshot.state;
      const currentProps = toIosProps(snapshot, currentState);

      // 로그아웃 스냅샷은 날짜와 무관하므로 자정 엔트리가 필요 없다
      const entries =
        snapshot.state === 'loggedOut'
          ? [{ date: now, props: currentProps }]
          : [
              { date: now, props: currentProps },
              { date: nextLocalMidnight(now), props: toIosProps(snapshot, 'stale') },
            ];

      aidoProgressWidget.updateTimeline(entries);
      aidoTodayListWidget.updateTimeline(entries);
    },
  };
}
