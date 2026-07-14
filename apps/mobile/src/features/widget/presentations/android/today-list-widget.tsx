'use no memo';

import { FlexWidget, TextWidget } from 'react-native-android-widget';

import {
  type WidgetRenderState,
  type WidgetSnapshot,
  WidgetSnapshotPolicy,
  type WidgetTopTodo,
} from '../../models/widget-snapshot.model';
import {
  toWidgetHexColor,
  toWidgetRgbaColor,
  WIDGET_COLORS,
  type WidgetTheme,
} from '../constants/widget-colors.constant';
import type { AndroidWidgetFamily } from './android-widget-layout';
import { WIDGET_FONTS } from './widget-assets';
import { ProgressBar, StateWidget } from './widget-primitives';

const FIXED_TEXT_SCALE = false;

export interface TodayListWidgetProps {
  snapshot: WidgetSnapshot;
  theme: WidgetTheme;
  renderState: WidgetRenderState;
  family: AndroidWidgetFamily;
}

/** Android 3종 위젯 — iOS systemSmall/Medium/Large와 동일한 정보 구조를 사용한다. */
export function TodayListWidget({ snapshot, theme, renderState, family }: TodayListWidgetProps) {
  if (renderState !== 'data') {
    const stateScreen = WidgetSnapshotPolicy.stateScreenStrings(snapshot, renderState);
    return <StateWidget theme={theme} title={stateScreen.title} cta={stateScreen.cta} />;
  }

  if (family === 'small') {
    return <SummaryWidget snapshot={snapshot} theme={theme} />;
  }

  return <TodoCollectionWidget snapshot={snapshot} theme={theme} family={family} />;
}

function SummaryWidget({ snapshot, theme }: { snapshot: WidgetSnapshot; theme: WidgetTheme }) {
  const palette = WIDGET_COLORS[theme];
  const progressLabel = snapshot.isComplete
    ? snapshot.strings.allDoneLabel
    : snapshot.strings.percentLabel;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel={`${snapshot.strings.progressTitle}. ${snapshot.completedTodos}/${snapshot.totalTodos}. ${progressLabel}`}
      style={{
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: palette.background,
        borderRadius: 16,
        padding: 10,
        flexDirection: 'column',
      }}
    >
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        <TextWidget
          text={snapshot.strings.progressTitle}
          maxLines={1}
          allowFontScaling={FIXED_TEXT_SCALE}
          style={{
            fontSize: 11,
            fontFamily: WIDGET_FONTS.medium,
            color: palette.muted,
            adjustsFontSizeToFit: true,
          }}
        />
        <FlexWidget style={{ flex: 1 }} />
        <TextWidget
          text={snapshot.isComplete ? '🎉' : '🐾'}
          allowFontScaling={FIXED_TEXT_SCALE}
          style={{ fontSize: 12 }}
        />
      </FlexWidget>

      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          alignItems: 'flex-end',
          marginTop: 4,
          flexGap: 2,
        }}
      >
        <TextWidget
          text={`${snapshot.completedTodos}`}
          allowFontScaling={FIXED_TEXT_SCALE}
          style={{ fontSize: 28, fontFamily: WIDGET_FONTS.bold, color: palette.brand }}
        />
        <TextWidget
          text={`/${snapshot.totalTodos}`}
          allowFontScaling={FIXED_TEXT_SCALE}
          style={{
            fontSize: 16,
            fontFamily: WIDGET_FONTS.semibold,
            color: palette.muted,
            paddingBottom: 2,
          }}
        />
      </FlexWidget>

      <FlexWidget style={{ width: 'match_parent', marginTop: 4 }}>
        <ProgressBar rate={snapshot.completionRate} theme={theme} height={5} />
      </FlexWidget>

      <FlexWidget
        style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', marginTop: 4 }}
      >
        <TextWidget
          text={progressLabel}
          maxLines={1}
          allowFontScaling={FIXED_TEXT_SCALE}
          style={{
            fontSize: 10,
            fontFamily: WIDGET_FONTS.medium,
            color: snapshot.isComplete ? palette.brand : palette.muted,
            adjustsFontSizeToFit: true,
          }}
        />
        <FlexWidget style={{ flex: 1 }} />
        {snapshot.currentStreak > 0 ? (
          <TextWidget
            text={`🔥 ${snapshot.strings.compactStreakLabel ?? snapshot.strings.streakLabel}`}
            maxLines={1}
            allowFontScaling={FIXED_TEXT_SCALE}
            style={{
              fontSize: 10,
              fontFamily: WIDGET_FONTS.medium,
              color: palette.brand,
              adjustsFontSizeToFit: true,
            }}
          />
        ) : null}
      </FlexWidget>
    </FlexWidget>
  );
}

function TodoCollectionWidget({
  snapshot,
  theme,
  family,
}: {
  snapshot: WidgetSnapshot;
  theme: WidgetTheme;
  family: Exclude<AndroidWidgetFamily, 'small'>;
}) {
  const palette = WIDGET_COLORS[theme];
  const isLarge = family === 'large';
  const maxRows = isLarge ? 8 : 3;
  const visibleTodos = snapshot.topTodos.slice(0, maxRows);
  const overflowCount = snapshot.totalTodos - visibleTodos.length;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel={`${snapshot.strings.progressTitle}. ${snapshot.completedTodos}/${snapshot.totalTodos}`}
      style={{
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: palette.background,
        borderRadius: 16,
        paddingHorizontal: isLarge ? 16 : 12,
        paddingVertical: isLarge ? 12 : 8,
        flexDirection: 'column',
      }}
    >
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        <TextWidget
          text={snapshot.strings.progressTitle}
          maxLines={1}
          allowFontScaling={FIXED_TEXT_SCALE}
          style={{
            fontSize: isLarge ? 13 : 12,
            fontFamily: WIDGET_FONTS.medium,
            color: palette.muted,
            adjustsFontSizeToFit: true,
          }}
        />
        <FlexWidget style={{ flex: 1 }} />
        {snapshot.isComplete ? (
          <TextWidget
            text={`🎉 ${snapshot.strings.allDoneLabel}`}
            maxLines={1}
            allowFontScaling={FIXED_TEXT_SCALE}
            style={{
              fontSize: isLarge ? 13 : 12,
              fontFamily: WIDGET_FONTS.semibold,
              color: palette.brand,
              adjustsFontSizeToFit: true,
            }}
          />
        ) : (
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <TextWidget
              text={`${snapshot.completedTodos}`}
              allowFontScaling={FIXED_TEXT_SCALE}
              style={{
                fontSize: isLarge ? 14 : 13,
                fontFamily: WIDGET_FONTS.bold,
                color: palette.brand,
              }}
            />
            <TextWidget
              text={`/${snapshot.totalTodos}`}
              allowFontScaling={FIXED_TEXT_SCALE}
              style={{
                fontSize: isLarge ? 13 : 12,
                fontFamily: WIDGET_FONTS.semibold,
                color: palette.muted,
              }}
            />
          </FlexWidget>
        )}
      </FlexWidget>

      <FlexWidget style={{ width: 'match_parent', marginTop: isLarge ? 6 : 4 }}>
        <ProgressBar rate={snapshot.completionRate} theme={theme} height={isLarge ? 4 : 3} />
      </FlexWidget>

      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'column',
          marginTop: isLarge ? 6 : 4,
        }}
      >
        {visibleTodos.map((todo) => (
          <TodoRow key={String(todo.id)} todo={todo} theme={theme} compact={!isLarge} />
        ))}
      </FlexWidget>

      {overflowCount > 0 ? (
        <FlexWidget
          style={{ width: 'match_parent', flexDirection: 'row', marginTop: isLarge ? 2 : 1 }}
        >
          <FlexWidget style={{ flex: 1 }} />
          <TextWidget
            text={snapshot.strings.moreLabelTemplate.replace('{count}', String(overflowCount))}
            maxLines={1}
            allowFontScaling={FIXED_TEXT_SCALE}
            style={{
              fontSize: isLarge ? 11 : 10,
              fontFamily: WIDGET_FONTS.regular,
              color: palette.muted,
              adjustsFontSizeToFit: true,
            }}
          />
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}

/** 카테고리 컬러 체크박스 + 한 줄 제목. iOS와 동일한 완료/미완료 표현을 사용한다. */
function TodoRow({
  todo,
  theme,
  compact,
}: {
  todo: WidgetTopTodo;
  theme: WidgetTheme;
  compact: boolean;
}) {
  const palette = WIDGET_COLORS[theme];
  const categoryColor = toWidgetHexColor(todo.categoryColor, palette.brand);
  const checkboxSize = compact ? 15 : 18;

  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: compact ? 17 : 20,
        flexDirection: 'row',
        alignItems: 'center',
        flexGap: compact ? 8 : 10,
      }}
    >
      <FlexWidget
        style={{
          width: checkboxSize,
          height: checkboxSize,
          borderRadius: 5,
          backgroundColor: todo.completed
            ? categoryColor
            : toWidgetRgbaColor(categoryColor, palette.brand, 0.25),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {todo.completed ? (
          <TextWidget
            text="✓"
            allowFontScaling={FIXED_TEXT_SCALE}
            style={{ fontSize: 11, fontWeight: 'bold', color: '#FFFFFF' }}
          />
        ) : null}
      </FlexWidget>
      <FlexWidget style={{ flex: 1, flexDirection: 'row' }}>
        <TextWidget
          text={todo.title}
          truncate="END"
          maxLines={1}
          allowFontScaling={FIXED_TEXT_SCALE}
          style={{
            width: 'match_parent',
            fontSize: compact ? 12 : 15,
            fontFamily: WIDGET_FONTS.regular,
            color: todo.completed ? palette.muted : palette.foreground,
            adjustsFontSizeToFit: true,
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
