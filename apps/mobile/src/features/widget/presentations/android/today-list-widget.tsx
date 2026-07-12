import { FlexWidget, ImageWidget, TextWidget } from 'react-native-android-widget';

import type {
  WidgetRenderState,
  WidgetSnapshot,
  WidgetTopTodo,
} from '../../models/widget-snapshot.model';
import {
  toWidgetHexColor,
  WIDGET_COLORS,
  type WidgetTheme,
} from '../constants/widget-colors.constant';
import { WIDGET_FONTS, WIDGET_MASCOT_IMAGE, WIDGET_PERFECT_IMAGE } from './widget-assets';
import { ProgressBar, StateWidget } from './widget-primitives';

export interface TodayListWidgetProps {
  snapshot: WidgetSnapshot;
  theme: WidgetTheme;
  renderState: WidgetRenderState;
  /** compact = 2x2 등 좁은 폭: 카운트 히어로 요약, list = 할 일 목록 */
  variant: 'compact' | 'list';
  /** list 변형의 표시 행 수 (4x2: 3행, 세로 리사이즈 시 최대 8행) */
  maxRows: number;
}

/**
 * 오늘 할 일 위젯 — 앱 홈과 동일한 시각 언어(카테고리 컬러 체크박스)로
 * 오늘 할 일의 체크 여부를 보여준다. 좁은 폭에서는 카운트 요약으로 전환.
 */
export function TodayListWidget({
  snapshot,
  theme,
  renderState,
  variant,
  maxRows,
}: TodayListWidgetProps) {
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

  if (variant === 'compact') {
    return (
      <FlexWidget
        clickAction="OPEN_APP"
        style={{
          width: 'match_parent',
          height: 'match_parent',
          backgroundColor: palette.background,
          borderRadius: 16,
          padding: 14,
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <FlexWidget
          style={{
            width: 'match_parent',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <TextWidget
            text={snapshot.strings.progressTitle}
            style={{ fontSize: 12, fontFamily: WIDGET_FONTS.medium, color: palette.muted }}
          />
          <ImageWidget
            image={snapshot.isComplete ? WIDGET_PERFECT_IMAGE : WIDGET_MASCOT_IMAGE}
            imageWidth={26}
            imageHeight={26}
          />
        </FlexWidget>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end', flexGap: 2 }}>
          <TextWidget
            text={`${snapshot.completedTodos}`}
            style={{ fontSize: 32, fontFamily: WIDGET_FONTS.bold, color: palette.brand }}
          />
          <TextWidget
            text={`/${snapshot.totalTodos}`}
            style={{
              fontSize: 18,
              fontFamily: WIDGET_FONTS.semibold,
              color: palette.muted,
              paddingBottom: 3,
            }}
          />
        </FlexWidget>
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', flexGap: 6 }}>
          <ProgressBar rate={snapshot.completionRate} theme={theme} height={6} />
          <TextWidget
            text={
              snapshot.isComplete
                ? snapshot.strings.allDoneLabel
                : snapshot.currentStreak > 0
                  ? `🔥 ${snapshot.strings.streakLabel}`
                  : snapshot.strings.percentLabel
            }
            style={{
              fontSize: 11,
              fontFamily: WIDGET_FONTS.medium,
              color: snapshot.isComplete ? palette.brand : palette.muted,
            }}
          />
        </FlexWidget>
      </FlexWidget>
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
          style={{ fontSize: 12, fontFamily: WIDGET_FONTS.medium, color: palette.muted }}
        />
        {snapshot.isComplete ? (
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 5 }}>
            <ImageWidget image={WIDGET_PERFECT_IMAGE} imageWidth={18} imageHeight={18} />
            <TextWidget
              text={snapshot.strings.allDoneLabel}
              style={{ fontSize: 13, fontFamily: WIDGET_FONTS.semibold, color: palette.brand }}
            />
          </FlexWidget>
        ) : (
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <TextWidget
              text={`${snapshot.completedTodos}`}
              style={{ fontSize: 14, fontFamily: WIDGET_FONTS.bold, color: palette.brand }}
            />
            <TextWidget
              text={`/${snapshot.totalTodos}`}
              style={{ fontSize: 13, fontFamily: WIDGET_FONTS.semibold, color: palette.muted }}
            />
          </FlexWidget>
        )}
      </FlexWidget>

      <ProgressBar rate={snapshot.completionRate} theme={theme} height={3} />

      <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', marginTop: 6 }}>
        {visibleTodos.map((todo) => (
          <TodoRow key={String(todo.id)} todo={todo} theme={theme} />
        ))}
      </FlexWidget>

      {overflowCount > 0 ? (
        <TextWidget
          text={snapshot.strings.moreLabelTemplate.replace('{count}', String(overflowCount))}
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

/** 카테고리 컬러 체크박스(앱 홈과 동일한 라운드 사각형) + 제목 */
function TodoRow({ todo, theme }: { todo: WidgetTopTodo; theme: WidgetTheme }) {
  const palette = WIDGET_COLORS[theme];
  const categoryColor = toWidgetHexColor(todo.categoryColor, palette.brand);

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
            borderRadius: 6,
            backgroundColor: categoryColor,
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
            borderRadius: 6,
            borderWidth: 2,
            borderColor: categoryColor,
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
