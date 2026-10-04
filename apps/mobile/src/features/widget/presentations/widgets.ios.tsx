import {
  Gauge,
  Divider,
  Link,
  HStack,
  Image,
  RoundedRectangle,
  Spacer,
  Text,
  VStack,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  containerBackground,
  background,
  cornerRadius,
  font,
  foregroundColor,
  frame,
  gaugeStyle,
  lineLimit,
  monospacedDigit,
  opacity,
  padding,
  tint,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { ReactElement } from 'react';

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
    brandSurface: isDark ? '#3E2118' : '#FFF0EB',
  };

  const rootModifiers = [
    containerBackground(palette.background, 'widget'),
    ...(props.openAppUrl ? [widgetURL(props.openAppUrl)] : []),
  ];

  const renderPaw = () => (
    <HStack spacing={1} modifiers={[frame({ width: 24, height: 20 })]}>
      <Image
        systemName="pawprint.fill"
        size={11}
        color={palette.brand}
        modifiers={[padding({ bottom: 6 })]}
      />
      <Image
        systemName="pawprint.fill"
        size={11}
        color={palette.brand}
        modifiers={[padding({ top: 6 })]}
      />
    </HStack>
  );

  if (
    props.state === 'loggedOut' ||
    props.state === 'stale' ||
    (props.state === 'empty' && environment.widgetFamily === 'systemSmall')
  ) {
    return (
      <VStack spacing={6} modifiers={[padding({ all: 16 }), ...rootModifiers]}>
        {renderPaw()}
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
      <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 14 }), ...rootModifiers]}>
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
          {renderPaw()}
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

  const isLargeWidget =
    environment.widgetFamily === 'systemLarge' || environment.widgetFamily === 'systemExtraLarge';
  const visibleTodos = props.topTodos.slice(0, isLargeWidget ? 4 : 2);
  const hiddenTodoCount = Math.max(0, props.totalTodos - visibleTodos.length);
  const renderAppLink = (destination: string | undefined, children: ReactElement) => (
    <Link destination={destination ?? props.openAppUrl ?? 'aido://feed?date=today'}>
      {children}
    </Link>
  );
  const renderTodoRow = (todo?: WidgetProps['topTodos'][number]) => {
    if (!todo) return null;
    return renderAppLink(
      todo.destination,
      <HStack spacing={8} modifiers={[frame({ height: isLargeWidget ? 27 : 30 })]}>
        <ZStack modifiers={[frame({ width: 16, height: 16 })]}>
          <RoundedRectangle
            cornerRadius={5}
            modifiers={[
              foregroundColor(todo.color),
              frame({ width: 16, height: 16 }),
              opacity(todo.completed ? 1 : 0.25),
            ]}
          />
          {todo.completed ? (
            <Text modifiers={[font({ size: 10, weight: 'bold' }), foregroundColor('#FFFFFF')]}>
              ✓
            </Text>
          ) : null}
        </ZStack>
        <Text
          modifiers={[
            font({ size: 13 }),
            foregroundColor(todo.completed ? palette.muted : palette.foreground),
            lineLimit(1),
          ]}
        >
          {todo.title}
        </Text>
        <Spacer />
      </HStack>,
    );
  };
  const renderAddTodo = () =>
    renderAppLink(
      props.addTodoUrl,
      <Text
        modifiers={[
          font({ size: 12, weight: 'semibold', design: 'rounded' }),
          foregroundColor(palette.brand),
          lineLimit(1),
          padding({ horizontal: 10, vertical: 6 }),
          background(palette.brandSurface),
          cornerRadius(9),
        ]}
      >{`＋ ${props.addTodoLabel ?? props.stateCta}`}</Text>,
    );
  const renderCount = (size: number) => (
    <HStack alignment="lastTextBaseline" spacing={2}>
      <Text
        modifiers={[
          font({ size, weight: 'bold', design: 'rounded' }),
          monospacedDigit(),
          foregroundColor(palette.brand),
        ]}
      >{`${props.completedTodos}`}</Text>
      <Text
        modifiers={[
          font({ size: Math.round(size * 0.55), weight: 'semibold', design: 'rounded' }),
          monospacedDigit(),
          foregroundColor(palette.muted),
        ]}
      >{`/${props.totalTodos}`}</Text>
    </HStack>
  );

  if (!isLargeWidget) {
    return (
      <HStack spacing={16} modifiers={[padding({ all: 16 }), ...rootModifiers]}>
        <VStack alignment="leading" spacing={8} modifiers={[frame({ width: 82 })]}>
          <Text
            modifiers={[
              font({ size: 11, weight: 'medium', design: 'rounded' }),
              foregroundColor(palette.muted),
              lineLimit(1),
            ]}
          >
            {props.progressTitle}
          </Text>
          {renderCount(32)}
          <Gauge
            value={props.completionRate}
            min={0}
            max={100}
            modifiers={[gaugeStyle('linearCapacity'), tint(palette.brand), frame({ height: 4 })]}
          />
          <HStack spacing={4}>
            {renderPaw()}
            <Text
              modifiers={[
                font({ size: 11, design: 'rounded' }),
                foregroundColor(palette.brand),
                lineLimit(1),
              ]}
            >
              {props.currentStreak > 0 ? props.compactStreakLabel : props.percentLabel}
            </Text>
          </HStack>
        </VStack>
        <Divider modifiers={[opacity(0.5)]} />
        <VStack alignment="leading" spacing={4}>
          {props.state === 'empty' ? (
            <Text
              modifiers={[
                font({ size: 12 }),
                foregroundColor(palette.muted),
                lineLimit(2),
                frame({ height: 60 }),
              ]}
            >
              {props.stateTitle}
            </Text>
          ) : null}
          {renderTodoRow(visibleTodos[0])}
          {renderTodoRow(visibleTodos[1])}
          <HStack>
            {renderAddTodo()}
            <Spacer />
          </HStack>
        </VStack>
      </HStack>
    );
  }

  const renderWeekDay = (day?: NonNullable<WidgetProps['weekDays']>[number], index = 0) => {
    if (!day) return null;
    return renderAppLink(
      day.destination,
      <VStack spacing={4} modifiers={[frame({ width: 28 })]}>
        <Text
          modifiers={[
            font({ size: 10, design: 'rounded' }),
            foregroundColor(index === 0 ? '#FF5858' : index === 6 ? '#2598E8' : palette.muted),
          ]}
        >
          {day.weekdayLabel}
        </Text>
        <ZStack modifiers={[frame({ width: 28, height: 28 })]}>
          {day.isToday ? (
            <RoundedRectangle
              cornerRadius={14}
              modifiers={[foregroundColor(palette.brand), frame({ width: 28, height: 28 })]}
            />
          ) : null}
          <Text
            modifiers={[
              font({ size: 14, weight: day.isToday ? 'bold' : 'medium', design: 'rounded' }),
              foregroundColor(day.isToday ? '#FFFFFF' : palette.foreground),
            ]}
          >
            {day.dayLabel}
          </Text>
        </ZStack>
        <HStack modifiers={[frame({ width: 24, height: 14 })]}>
          {day.isComplete ? (
            <Image systemName="pawprint.fill" size={12} color={palette.brand} />
          ) : (
            <Text modifiers={[font({ size: 14 }), foregroundColor(palette.brand)]}>
              {day.hasTodos ? '•' : ' '}
            </Text>
          )}
        </HStack>
      </VStack>,
    );
  };
  const weekDays = props.weekDays ?? [];

  return (
    <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 16 }), ...rootModifiers]}>
      <HStack spacing={4}>
        <Text
          modifiers={[
            font({ size: 14, weight: 'semibold', design: 'rounded' }),
            foregroundColor(palette.foreground),
            lineLimit(1),
          ]}
        >
          {props.weekTitle ?? props.progressTitle}
        </Text>
        {renderPaw()}
        <Spacer />
      </HStack>
      {props.weekRangeLabel ? (
        <Text modifiers={[font({ size: 10, design: 'rounded' }), foregroundColor(palette.muted)]}>
          {props.weekRangeLabel}
        </Text>
      ) : null}
      <HStack spacing={0}>
        {renderWeekDay(weekDays[0], 0)}
        <Spacer />
        {renderWeekDay(weekDays[1], 1)}
        <Spacer />
        {renderWeekDay(weekDays[2], 2)}
        <Spacer />
        {renderWeekDay(weekDays[3], 3)}
        <Spacer />
        {renderWeekDay(weekDays[4], 4)}
        <Spacer />
        {renderWeekDay(weekDays[5], 5)}
        <Spacer />
        {renderWeekDay(weekDays[6], 6)}
      </HStack>
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
        {renderCount(22)}
      </HStack>
      <Gauge
        value={props.completionRate}
        min={0}
        max={100}
        modifiers={[gaugeStyle('linearCapacity'), tint(palette.brand), frame({ height: 4 })]}
      />
      <VStack alignment="leading" spacing={2}>
        {props.state === 'empty' ? (
          <Text
            modifiers={[
              font({ size: 13 }),
              foregroundColor(palette.muted),
              lineLimit(2),
              frame({ height: 108 }),
            ]}
          >
            {props.stateTitle}
          </Text>
        ) : null}
        {renderTodoRow(visibleTodos[0])}
        {renderTodoRow(visibleTodos[1])}
        {renderTodoRow(visibleTodos[2])}
        {renderTodoRow(visibleTodos[3])}
      </VStack>
      <Spacer />
      <Divider modifiers={[opacity(0.5)]} />
      <HStack>
        <Text
          modifiers={[
            font({ size: 10, design: 'rounded' }),
            foregroundColor(palette.muted),
            lineLimit(1),
          ]}
        >
          {hiddenTodoCount > 0
            ? props.moreLabelTemplate.replace('{count}', String(hiddenTodoCount))
            : (props.openTodoLabel ?? '')}
        </Text>
        <Spacer />
        {renderAddTodo()}
      </HStack>
    </VStack>
  );
}

export const aidoTodayListWidget = createWidget<WidgetProps>(
  'AidoTodayList',
  AidoTodayListLayout,
  createInitialWidgetProps(),
);

export const aidoWidgets = [{ widget: aidoTodayListWidget, maxRows: 4 }];
