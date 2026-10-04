import {
  Box,
  Button,
  Column,
  Image,
  LinearProgressIndicator,
  Row,
  Spacer,
  Text,
} from '@expo/ui/jetpack-compose';
import {
  background,
  cornerRadius,
  fillMaxSize,
  fillMaxHeight,
  fillMaxWidth,
  height,
  paddingAll,
  padding,
  size,
  width,
} from '@expo/ui/jetpack-compose/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { ComponentProps, ReactNode } from 'react';

import type { WidgetProps } from '../models/widget-props.model';
import { createInitialWidgetProps } from './widget-initial-props';

// The isolated widget runtime cannot capture module helpers or app providers.
function AidoTodayLayout(props: WidgetProps, environment: WidgetEnvironment) {
  'widget';

  const isDark = environment.colorScheme === 'dark';
  const palette = {
    background: isDark ? '#171310' : '#FFFFFF',
    foreground: isDark ? '#F5F5F5' : '#333333',
    muted: isDark ? '#B7B7B7' : '#8F8F8F',
    track: isDark ? '#333333' : '#EBEBEB',
    brand: '#FF6B43',
    brandSurface: isDark ? '#3E2118' : '#FFF0EB',
  };
  // Android does not expose an entry date in WidgetEnvironment.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isStale = props.state !== 'loggedOut' && props.date !== today;

  const renderPaw = () => (
    <Image
      source={{ uri: 'aido_widget_paw' }}
      tint={palette.brand}
      contentDescription={null}
      modifiers={[size(24, 20)]}
    />
  );

  if (
    props.state === 'loggedOut' ||
    props.state === 'stale' ||
    isStale ||
    (props.state === 'empty' && props.maxRows === 0)
  ) {
    return (
      <Column
        horizontalAlignment="center"
        verticalArrangement="center"
        modifiers={[
          fillMaxSize(),
          background(palette.background),
          cornerRadius(20),
          paddingAll(16),
        ]}
      >
        {renderPaw()}
        <Spacer modifiers={[height(6)]} />
        <Text color={palette.foreground} style={{ fontSize: 14, fontWeight: '600' }} maxLines={2}>
          {isStale ? props.staleTitle : props.stateTitle}
        </Text>
        <Spacer modifiers={[height(6)]} />
        <Text color={palette.muted} style={{ fontSize: 12 }} maxLines={2}>
          {isStale ? props.staleCta : props.stateCta}
        </Text>
      </Column>
    );
  }

  if (props.maxRows === 0) {
    return (
      <Column
        verticalArrangement="top"
        modifiers={[
          fillMaxSize(),
          background(palette.background),
          cornerRadius(20),
          paddingAll(14),
        ]}
      >
        <Box modifiers={[fillMaxWidth()]} contentAlignment="centerStart">
          <Text
            color={palette.muted}
            style={{ fontSize: 12, fontWeight: '500' }}
            modifiers={[fillMaxWidth()]}
          >
            {props.progressTitle}
          </Text>
          <Box modifiers={[fillMaxWidth()]} contentAlignment="centerEnd">
            {renderPaw()}
          </Box>
        </Box>
        <Spacer modifiers={[height(8)]} />
        <Row verticalAlignment="bottom">
          <Text color={palette.brand} style={{ fontSize: 34, fontWeight: 'bold' }}>
            {props.completedTodos}
          </Text>
          <Text
            color={palette.muted}
            style={{ fontSize: 18, fontWeight: '600' }}
          >{`/${props.totalTodos}`}</Text>
        </Row>
        <Spacer modifiers={[height(8)]} />
        <LinearProgressIndicator
          progress={props.completionRate / 100}
          color={palette.brand}
          trackColor={palette.track}
          modifiers={[fillMaxWidth(), height(6)]}
        />
        <Spacer modifiers={[height(8)]} />
        <Box modifiers={[fillMaxWidth()]} contentAlignment="centerStart">
          <Text
            color={props.isComplete ? palette.brand : palette.muted}
            style={{ fontSize: 11, fontWeight: '500' }}
            maxLines={1}
            modifiers={[fillMaxWidth()]}
          >
            {props.isComplete ? props.allDoneLabel : props.percentLabel}
          </Text>
          {props.currentStreak > 0 ? (
            <Text
              color={palette.brand}
              style={{ fontSize: 11, fontWeight: '500', textAlign: 'end' }}
              maxLines={1}
              modifiers={[fillMaxWidth()]}
            >{`🔥 ${props.compactStreakLabel}`}</Text>
          ) : null}
        </Box>
      </Column>
    );
  }

  const isLargeWidget = props.maxRows > 3;
  const visibleTodos = props.topTodos.slice(0, isLargeWidget ? 4 : 2);
  const transparentButtonColors = {
    containerColor: 'transparent',
    contentColor: palette.foreground,
  };
  const zeroContentPadding = { start: 0, top: 0, end: 0, bottom: 0 };

  const renderAppLink = (
    destination: string | undefined,
    children: ReactNode,
    buttonHeight: number,
  ) => {
    const linkProps: ComponentProps<typeof Button> & { target?: string } = {
      target: destination ?? props.openAppUrl ?? '__aido_widget_open_app',
      enabled: true,
      colors: transparentButtonColors,
      contentPadding: zeroContentPadding,
      modifiers: [fillMaxWidth(), height(buttonHeight)],
      children,
    };
    return <Button {...linkProps} />;
  };

  const renderTodoRow = (todo?: WidgetProps['topTodos'][number]) => {
    if (!todo) return null;
    const checkboxColor = todo.completed
      ? todo.color
      : `rgba(${Number.parseInt(todo.color.slice(1, 3), 16)}, ${Number.parseInt(todo.color.slice(3, 5), 16)}, ${Number.parseInt(todo.color.slice(5, 7), 16)}, 0.25)`;
    return renderAppLink(
      todo.destination,
      <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
        <Box
          contentAlignment="center"
          modifiers={[size(16, 16), background(checkboxColor), cornerRadius(5)]}
        >
          {todo.completed ? (
            <Text color="#FFFFFF" style={{ fontSize: 10, fontWeight: 'bold' }}>
              ✓
            </Text>
          ) : null}
        </Box>
        <Spacer modifiers={[width(8)]} />
        <Text
          color={todo.completed ? palette.muted : palette.foreground}
          style={{ fontSize: 13 }}
          maxLines={1}
          overflow="ellipsis"
        >
          {todo.title}
        </Text>
      </Row>,
      isLargeWidget ? 22 : 26,
    );
  };

  const renderAddTodo = () => {
    const linkProps: ComponentProps<typeof Button> & { target?: string } = {
      target: props.addTodoUrl ?? props.openAppUrl ?? '__aido_widget_open_app',
      colors: { containerColor: palette.brandSurface, contentColor: palette.brand },
      contentPadding: { start: 8, top: 4, end: 8, bottom: 4 },
      modifiers: [cornerRadius(9), height(26)],
      children: (
        <Text
          color={palette.brand}
          style={{ fontSize: 12, fontWeight: '600' }}
          maxLines={1}
        >{`＋ ${props.addTodoLabel ?? props.stateCta}`}</Text>
      ),
    };
    return <Button {...linkProps} />;
  };

  if (!isLargeWidget) {
    return (
      <Box
        modifiers={[
          fillMaxSize(),
          background(palette.background),
          cornerRadius(20),
          paddingAll(12),
        ]}
      >
        <Row verticalAlignment="center" modifiers={[width(96), fillMaxHeight()]}>
          <Column modifiers={[width(84)]}>
            <Text color={palette.muted} style={{ fontSize: 11, fontWeight: '500' }} maxLines={1}>
              {props.progressTitle}
            </Text>
            <Spacer modifiers={[height(4)]} />
            <Row verticalAlignment="bottom">
              <Text color={palette.brand} style={{ fontSize: 32, fontWeight: 'bold' }}>
                {props.completedTodos}
              </Text>
              <Text
                color={palette.muted}
                style={{ fontSize: 17, fontWeight: '600' }}
              >{`/${props.totalTodos}`}</Text>
            </Row>
            <Spacer modifiers={[height(6)]} />
            <LinearProgressIndicator
              progress={props.completionRate / 100}
              color={palette.brand}
              trackColor={palette.track}
              modifiers={[fillMaxWidth(), height(4)]}
            />
            <Spacer modifiers={[height(6)]} />
            <Row verticalAlignment="center">
              {renderPaw()}
              <Spacer modifiers={[width(4)]} />
              <Text color={palette.brand} style={{ fontSize: 11 }} maxLines={1}>
                {props.currentStreak > 0 ? props.compactStreakLabel : props.percentLabel}
              </Text>
            </Row>
          </Column>
          <Spacer modifiers={[width(10)]} />
          <Box modifiers={[width(1), fillMaxHeight(), background(palette.track)]} />
        </Row>
        <Column verticalArrangement="center" modifiers={[fillMaxSize(), padding(112, 0, 0, 0)]}>
          {props.state === 'empty' ? (
            <Box contentAlignment="centerStart" modifiers={[fillMaxWidth(), height(56)]}>
              <Text color={palette.muted} style={{ fontSize: 12 }} maxLines={2}>
                {props.stateTitle}
              </Text>
            </Box>
          ) : (
            <Column modifiers={[fillMaxWidth()]}>
              {renderTodoRow(visibleTodos[0])}
              {visibleTodos[1] ? <Spacer modifiers={[height(4)]} /> : null}
              {renderTodoRow(visibleTodos[1])}
            </Column>
          )}
          <Spacer modifiers={[height(4)]} />
          {renderAddTodo()}
        </Column>
      </Box>
    );
  }

  const renderWeekDay = (day?: NonNullable<WidgetProps['weekDays']>[number], index = 0) => {
    if (!day) return null;
    const linkProps: ComponentProps<typeof Button> & { target: string } = {
      target: day.destination,
      colors: transparentButtonColors,
      contentPadding: zeroContentPadding,
      modifiers: [width(30), height(48)],
      children: (
        <Column horizontalAlignment="center">
          <Text
            color={index === 0 ? '#FF5858' : index === 6 ? '#2598E8' : palette.muted}
            style={{ fontSize: 10 }}
          >
            {day.weekdayLabel}
          </Text>
          <Box
            contentAlignment="center"
            modifiers={[
              size(24, 24),
              cornerRadius(12),
              background(day.isToday ? palette.brand : 'transparent'),
            ]}
          >
            <Text
              color={day.isToday ? '#FFFFFF' : palette.foreground}
              style={{ fontSize: 13, fontWeight: day.isToday ? 'bold' : '500' }}
            >
              {day.dayLabel}
            </Text>
          </Box>
          {day.isComplete ? (
            <Image
              source={{ uri: 'aido_widget_paw' }}
              tint={palette.brand}
              contentDescription={null}
              modifiers={[size(16, 13)]}
            />
          ) : (
            <Text color={palette.brand} style={{ fontSize: 11 }}>
              {day.hasTodos ? '•' : ' '}
            </Text>
          )}
        </Column>
      ),
    };
    return <Button {...linkProps} />;
  };
  const weekDays = props.weekDays ?? [];

  return (
    <Box
      modifiers={[fillMaxSize(), background(palette.background), cornerRadius(20), paddingAll(14)]}
    >
      <Column modifiers={[fillMaxSize(), padding(0, 0, 0, 34)]}>
        <Column modifiers={[fillMaxWidth()]}>
          <Box contentAlignment="centerStart" modifiers={[fillMaxWidth()]}>
            <Text
              color={palette.foreground}
              style={{ fontSize: 13, fontWeight: '600' }}
              maxLines={1}
              modifiers={[fillMaxWidth(), padding(0, 0, 30, 0)]}
            >
              {props.weekTitle ?? props.progressTitle}
            </Text>
            <Box contentAlignment="centerEnd" modifiers={[fillMaxWidth()]}>
              {renderPaw()}
            </Box>
          </Box>
          {props.weekRangeLabel ? (
            <Text color={palette.muted} style={{ fontSize: 9 }}>
              {props.weekRangeLabel}
            </Text>
          ) : null}
        </Column>
        <Spacer modifiers={[height(4)]} />
        <Row horizontalArrangement="center" modifiers={[fillMaxWidth()]}>
          {renderWeekDay(weekDays[0], 0)}
          {renderWeekDay(weekDays[1], 1)}
          {renderWeekDay(weekDays[2], 2)}
          {renderWeekDay(weekDays[3], 3)}
          {renderWeekDay(weekDays[4], 4)}
          {renderWeekDay(weekDays[5], 5)}
          {renderWeekDay(weekDays[6], 6)}
        </Row>
        <Spacer modifiers={[height(4)]} />
        <Box contentAlignment="centerStart" modifiers={[fillMaxWidth()]}>
          <Text color={palette.muted} style={{ fontSize: 12 }}>
            {props.progressTitle}
          </Text>
          <Text
            color={palette.brand}
            style={{ fontSize: 16, fontWeight: 'bold', textAlign: 'end' }}
            modifiers={[fillMaxWidth()]}
          >{`${props.completedTodos}/${props.totalTodos}`}</Text>
        </Box>
        <Spacer modifiers={[height(4)]} />
        <LinearProgressIndicator
          progress={props.completionRate / 100}
          color={palette.brand}
          trackColor={palette.track}
          modifiers={[fillMaxWidth(), height(4)]}
        />
        <Spacer modifiers={[height(4)]} />
        <Column modifiers={[fillMaxWidth()]}>
          {props.state === 'empty' ? (
            <Box contentAlignment="center" modifiers={[fillMaxWidth(), height(88)]}>
              <Text color={palette.muted} style={{ fontSize: 13 }} maxLines={2}>
                {props.stateTitle}
              </Text>
            </Box>
          ) : null}
          {renderTodoRow(visibleTodos[0])}
          {renderTodoRow(visibleTodos[1])}
          {renderTodoRow(visibleTodos[2])}
          {renderTodoRow(visibleTodos[3])}
        </Column>
      </Column>
      <Box contentAlignment="bottomEnd" modifiers={[fillMaxSize()]}>
        <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
          <Text color={palette.muted} style={{ fontSize: 10 }} maxLines={1}>
            {props.openTodoLabel ?? ''}
          </Text>
        </Row>
        {renderAddTodo()}
      </Box>
    </Box>
  );
}

const initialProps = createInitialWidgetProps();

export const aidoWidgets = [
  {
    widget: createWidget<WidgetProps>('AidoTodaySummary', AidoTodayLayout, {
      ...initialProps,
      maxRows: 0,
    }),
    maxRows: 0,
  },
  {
    widget: createWidget<WidgetProps>('AidoTodayList', AidoTodayLayout, {
      ...initialProps,
      maxRows: 2,
    }),
    maxRows: 2,
  },
  {
    widget: createWidget<WidgetProps>('AidoTodayLarge', AidoTodayLayout, {
      ...initialProps,
      maxRows: 4,
    }),
    maxRows: 4,
  },
];
