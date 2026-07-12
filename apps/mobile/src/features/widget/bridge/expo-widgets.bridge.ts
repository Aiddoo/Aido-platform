import {
  type WidgetRenderState,
  type WidgetSnapshot,
  WidgetSnapshotPolicy,
} from '../models/widget-snapshot.model';
import { aidoTodayListWidget } from '../presentations/ios/aido-widgets';
import type { IosWidgetProps } from '../presentations/ios/ios-widget-props';
import type { WidgetBridge } from './widget-bridge';

function toIosProps(snapshot: WidgetSnapshot, state: WidgetRenderState): IosWidgetProps {
  const stateScreen = WidgetSnapshotPolicy.stateScreenStrings(snapshot, state);
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
      color: todo.categoryColor,
    })),
    progressTitle: snapshot.strings.progressTitle,
    percentLabel: snapshot.strings.percentLabel,
    streakLabel: snapshot.strings.streakLabel,
    allDoneLabel: snapshot.strings.allDoneLabel,
    moreLabelTemplate: snapshot.strings.moreLabelTemplate,
    stateTitle: stateScreen.title,
    stateCta: stateScreen.cta,
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
      const currentProps = toIosProps(snapshot, snapshot.state);

      // 로그아웃 스냅샷은 날짜와 무관하므로 자정 엔트리가 필요 없다
      const entries =
        snapshot.state === 'loggedOut'
          ? [{ date: now, props: currentProps }]
          : [
              { date: now, props: currentProps },
              { date: nextLocalMidnight(now), props: toIosProps(snapshot, 'stale') },
            ];

      aidoTodayListWidget.updateTimeline(entries);
    },
  };
}
