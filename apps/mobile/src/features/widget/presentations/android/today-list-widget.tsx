import { FlexWidget, TextWidget } from 'react-native-android-widget';

import type { WidgetTopTodo } from '../../models/widget-snapshot.model';
import { WIDGET_COLORS, type WidgetTheme } from '../constants/widget-colors.constant';
import { type AndroidWidgetProps, ProgressBar, StateWidget } from './progress-widget';
import { WIDGET_FONTS } from './widget-assets';

interface TodayListWidgetProps extends AndroidWidgetProps {
  /** 위젯 높이에 따른 표시 행 수 (4x2: 3행, 세로 리사이즈 시 최대 7행) */
  maxRows: number;
}

/**
 * 오늘 할 일 리스트 위젯 (4x2, 세로 리사이즈) — 헤더 진행률 + 할 일 목록.
 * 완료 행은 muted 처리로 시각적 위계를 낮춘다.
 */
export function TodayListWidget({ snapshot, theme, renderState, maxRows }: TodayListWidgetProps) {
  const palette = WIDGET_COLORS[theme];

  if (renderState !== 'data') {
    return (
      <StateWidget
        theme={theme}
        title={
          renderState === 'loggedOut'
            ? snapshot.strings.loggedOutTitle
            : renderState === 'stale'
              ? snapshot.strings.staleTitle
              : snapshot.strings.emptyTitle
        }
        cta={
          renderState === 'loggedOut'
            ? snapshot.strings.loggedOutCta
            : renderState === 'stale'
              ? snapshot.strings.staleCta
              : snapshot.strings.emptyCta
        }
      />
    );
  }

  const visibleTodos = snapshot.topTodos.slice(0, maxRows);
  const overflowCount = snapshot.totalTodos - visibleTodos.length;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: palette.background,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: 'column',
      }}
    >
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <TextWidget
          text={snapshot.strings.progressTitle}
          style={{
            fontSize: 12,
            fontFamily: WIDGET_FONTS.medium,
            color: palette.muted,
          }}
        />
        <TextWidget
          text={`${snapshot.completedTodos}/${snapshot.totalTodos}`}
          style={{
            fontSize: 13,
            fontFamily: WIDGET_FONTS.semibold,
            color: palette.foreground,
          }}
        />
      </FlexWidget>

      <ProgressBar rate={snapshot.completionRate} theme={theme} height={3} />

      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'column',
          marginTop: 6,
        }}
      >
        {visibleTodos.map((todo) => (
          <TodoRow key={String(todo.id)} todo={todo} theme={theme} />
        ))}
      </FlexWidget>

      {overflowCount > 0 && snapshot.strings.moreLabel !== '' ? (
        <TextWidget
          text={snapshot.strings.moreLabel}
          style={{
            fontSize: 11,
            fontFamily: WIDGET_FONTS.regular,
            color: palette.muted,
            marginTop: 4,
            paddingLeft: 30,
          }}
        />
      ) : null}
    </FlexWidget>
  );
}

function TodoRow({ todo, theme }: { todo: WidgetTopTodo; theme: WidgetTheme }) {
  const palette = WIDGET_COLORS[theme];

  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 5,
        flexGap: 10,
      }}
    >
      {todo.completed ? (
        <FlexWidget
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: palette.brand,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TextWidget text="✓" style={{ fontSize: 12, fontWeight: 'bold', color: '#FFFFFF' }} />
        </FlexWidget>
      ) : (
        <FlexWidget
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: palette.divider,
          }}
        />
      )}
      <FlexWidget style={{ flex: 1, flexDirection: 'row' }}>
        <TextWidget
          text={todo.title}
          truncate="END"
          maxLines={1}
          style={{
            width: 'match_parent',
            fontSize: 15,
            fontFamily: WIDGET_FONTS.regular,
            color: todo.completed ? palette.muted : palette.foreground,
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
