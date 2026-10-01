import { Gauge, HStack, RoundedRectangle, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundColor,
  frame,
  gaugeStyle,
  lineLimit,
  monospacedDigit,
  opacity,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { WidgetProps } from '../models/widget-props.model';
import { createInitialWidgetProps } from './widget-initial-props';

// Widget layouts execute in isolation; helpers and palette must stay inside this function.
function AidoTodayListLayout(props: WidgetProps, environment: WidgetEnvironment) {
  'widget';

  const isDark = environment.colorScheme === 'dark';
  const palette = {
    background: isDark ? '#171310' : '#FFFFFF',
    foreground: isDark ? '#F5F5F5' : '#333333',
    muted: isDark ? '#B7B7B7' : '#8F8F8F',
    brand: '#FF6B43',
  };

  if (props.state !== 'data') {
    return (
      <VStack
        spacing={6}
        modifiers={[padding({ all: 16 }), containerBackground(palette.background, 'widget')]}
      >
        <Text modifiers={[font({ size: 28 })]}>🐾</Text>
        <Text
          modifiers={[
            font({ size: 14, weight: 'semibold', design: 'rounded' }),
            foregroundColor(palette.foreground),
          ]}
        >
          {props.stateTitle}
        </Text>
        <Text modifiers={[font({ size: 12 }), foregroundColor(palette.muted)]}>
          {props.stateCta}
        </Text>
      </VStack>
    );
  }

  if (environment.widgetFamily === 'systemSmall') {
    return (
      <VStack
        alignment="leading"
        spacing={8}
        modifiers={[padding({ all: 14 }), containerBackground(palette.background, 'widget')]}
      >
        <HStack>
          <Text
            modifiers={[
              font({ size: 12, weight: 'medium', design: 'rounded' }),
              foregroundColor(palette.muted),
            ]}
          >
            {props.progressTitle}
          </Text>
          <Spacer />
          <Text modifiers={[font({ size: 13 }), opacity(props.isComplete ? 1 : 0.45)]}>
            {props.isComplete ? '🎉' : '🐾'}
          </Text>
        </HStack>
        <HStack alignment="lastTextBaseline" spacing={2}>
          <Text
            modifiers={[
              font({ size: 34, weight: 'bold', design: 'rounded' }),
              monospacedDigit(),
              foregroundColor(palette.brand),
            ]}
          >
            {`${props.completedTodos}`}
          </Text>
          <Text
            modifiers={[
              font({ size: 18, weight: 'semibold', design: 'rounded' }),
              monospacedDigit(),
              foregroundColor(palette.muted),
            ]}
          >
            {`/${props.totalTodos}`}
          </Text>
          <Spacer />
        </HStack>
        <Gauge
          value={props.completionRate}
          min={0}
          max={100}
          modifiers={[gaugeStyle('linearCapacity'), tint(palette.brand), frame({ height: 6 })]}
        />
        <HStack>
          <Text
            modifiers={[
              font({ size: 11, weight: 'medium', design: 'rounded' }),
              foregroundColor(props.isComplete ? palette.brand : palette.muted),
              lineLimit(1),
            ]}
          >
            {props.isComplete ? props.allDoneLabel : props.percentLabel}
          </Text>
          <Spacer />
          {props.currentStreak > 0 ? (
            <Text
              modifiers={[
                font({ size: 11, weight: 'medium', design: 'rounded' }),
                foregroundColor(palette.brand),
                lineLimit(1),
              ]}
            >
              {`🔥 ${props.compactStreakLabel}`}
            </Text>
          ) : null}
        </HStack>
      </VStack>
    );
  }

  const maxRows = environment.widgetFamily === 'systemLarge' ? 8 : 3;
  const visibleTodos = props.topTodos.slice(0, maxRows);
  const overflowCount = props.totalTodos - visibleTodos.length;

  // 카테고리 컬러 체크박스(앱 홈과 동일한 시각 언어): 완료 = 채움+✓, 미완료 = 연한 틴트
  const renderRow = (todo?: { title: string; completed: boolean; color: string }) => {
    if (!todo) {
      return null;
    }
    return (
      <HStack spacing={10}>
        <ZStack modifiers={[frame({ width: 18, height: 18 })]}>
          <RoundedRectangle
            cornerRadius={5}
            modifiers={[
              foregroundColor(todo.color),
              frame({ width: 18, height: 18 }),
              opacity(todo.completed ? 1 : 0.25),
            ]}
          />
          {todo.completed ? (
            <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundColor('#FFFFFF')]}>
              ✓
            </Text>
          ) : null}
        </ZStack>
        <Text
          modifiers={[
            font({ size: 15 }),
            foregroundColor(todo.completed ? palette.muted : palette.foreground),
            opacity(todo.completed ? 0.75 : 1),
            lineLimit(1),
          ]}
        >
          {todo.title}
        </Text>
        <Spacer />
      </HStack>
    );
  };

  return (
    <VStack
      alignment="leading"
      spacing={7}
      modifiers={[padding({ all: 16 }), containerBackground(palette.background, 'widget')]}
    >
      <HStack alignment="lastTextBaseline" spacing={0}>
        <Text
          modifiers={[
            font({ size: 13, weight: 'medium', design: 'rounded' }),
            foregroundColor(palette.muted),
          ]}
        >
          {props.progressTitle}
        </Text>
        <Spacer />
        {props.isComplete ? (
          <Text
            modifiers={[
              font({ size: 13, weight: 'semibold', design: 'rounded' }),
              foregroundColor(palette.brand),
            ]}
          >
            {`🎉 ${props.allDoneLabel}`}
          </Text>
        ) : (
          <Text
            modifiers={[
              font({ size: 14, weight: 'bold', design: 'rounded' }),
              monospacedDigit(),
              foregroundColor(palette.brand),
            ]}
          >
            {`${props.completedTodos}`}
          </Text>
        )}
        {props.isComplete ? null : (
          <Text
            modifiers={[
              font({ size: 13, weight: 'semibold', design: 'rounded' }),
              monospacedDigit(),
              foregroundColor(palette.muted),
            ]}
          >
            {`/${props.totalTodos}`}
          </Text>
        )}
      </HStack>

      <Gauge
        value={props.completionRate}
        min={0}
        max={100}
        modifiers={[gaugeStyle('linearCapacity'), tint(palette.brand), frame({ height: 4 })]}
      />

      {renderRow(visibleTodos[0])}
      {renderRow(visibleTodos[1])}
      {renderRow(visibleTodos[2])}
      {renderRow(visibleTodos[3])}
      {renderRow(visibleTodos[4])}
      {renderRow(visibleTodos[5])}
      {renderRow(visibleTodos[6])}
      {renderRow(visibleTodos[7])}

      {overflowCount > 0 ? (
        <HStack>
          <Spacer />
          <Text modifiers={[font({ size: 11, design: 'rounded' }), foregroundColor(palette.muted)]}>
            {props.moreLabelTemplate.replace('{count}', String(overflowCount))}
          </Text>
        </HStack>
      ) : null}
      <Spacer />
    </VStack>
  );
}

export const aidoTodayListWidget = createWidget<WidgetProps>(
  'AidoTodayList',
  AidoTodayListLayout,
  createInitialWidgetProps(),
);

export const aidoWidgets = [{ widget: aidoTodayListWidget, maxRows: 8 }];
