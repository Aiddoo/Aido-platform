import { Box, Column, LinearProgressIndicator, Row, Spacer, Text } from '@expo/ui/jetpack-compose';
import {
  background,
  cornerRadius,
  fillMaxSize,
  fillMaxWidth,
  height,
  paddingAll,
  size,
  width,
} from '@expo/ui/jetpack-compose/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

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
  };
  // Android does not expose an entry date in WidgetEnvironment.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isStale = props.state !== 'loggedOut' && props.date !== today;

  if (props.state !== 'data' || isStale) {
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
        <Text style={{ fontSize: 28 }}>🐾</Text>
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
          <Text style={{ fontSize: 13, textAlign: 'end' }} modifiers={[fillMaxWidth()]}>
            {props.isComplete ? '🎉' : '🐾'}
          </Text>
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

  const todos = props.topTodos.slice(0, props.maxRows);
  const overflowCount = props.totalTodos - todos.length;
  const rowSpacing = props.maxRows === 8 ? 4 : 7;
  const renderRow = (todo?: { title: string; completed: boolean; color: string }) => {
    if (!todo) return null;

    return (
      <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
        <Box
          contentAlignment="center"
          modifiers={[
            size(18, 18),
            background(
              todo.completed
                ? todo.color
                : `rgba(${Number.parseInt(todo.color.slice(1, 3), 16)}, ${Number.parseInt(todo.color.slice(3, 5), 16)}, ${Number.parseInt(todo.color.slice(5, 7), 16)}, 0.25)`,
            ),
            cornerRadius(5),
          ]}
        >
          {todo.completed ? (
            <Text color="#FFFFFF" style={{ fontSize: 11, fontWeight: 'bold' }}>
              ✓
            </Text>
          ) : null}
        </Box>
        <Spacer modifiers={[width(10)]} />
        <Text
          color={todo.completed ? palette.muted : palette.foreground}
          style={{ fontSize: props.maxRows === 8 ? 14 : 15 }}
          maxLines={1}
          overflow="ellipsis"
        >
          {todo.title}
        </Text>
      </Row>
    );
  };

  return (
    <Column
      verticalArrangement="top"
      modifiers={[
        fillMaxSize(),
        background(palette.background),
        cornerRadius(20),
        paddingAll(props.maxRows === 8 ? 14 : 16),
      ]}
    >
      <Box modifiers={[fillMaxWidth()]} contentAlignment="centerStart">
        <Text
          color={palette.muted}
          style={{ fontSize: 13, fontWeight: '500' }}
          modifiers={[fillMaxWidth()]}
        >
          {props.progressTitle}
        </Text>
        <Text
          color={palette.brand}
          style={{ fontSize: 14, fontWeight: 'bold', textAlign: 'end' }}
          modifiers={[fillMaxWidth()]}
        >
          {props.isComplete
            ? `🎉 ${props.allDoneLabel}`
            : `${props.completedTodos}/${props.totalTodos}`}
        </Text>
      </Box>
      <Spacer modifiers={[height(rowSpacing)]} />
      <LinearProgressIndicator
        progress={props.completionRate / 100}
        color={palette.brand}
        trackColor={palette.track}
        modifiers={[fillMaxWidth(), height(4)]}
      />
      <Spacer modifiers={[height(rowSpacing)]} />
      {/* Glance truncates a Column after ten direct children. */}
      <Column modifiers={[fillMaxWidth()]}>
        {renderRow(todos[0])}
        {todos[1] ? <Spacer modifiers={[height(rowSpacing)]} /> : null}
        {renderRow(todos[1])}
        {todos[2] ? <Spacer modifiers={[height(rowSpacing)]} /> : null}
        {renderRow(todos[2])}
        {todos[3] ? <Spacer modifiers={[height(rowSpacing)]} /> : null}
        {renderRow(todos[3])}
      </Column>
      {todos[4] ? (
        <Column modifiers={[fillMaxWidth()]}>
          <Spacer modifiers={[height(rowSpacing)]} />
          {renderRow(todos[4])}
          {todos[5] ? <Spacer modifiers={[height(rowSpacing)]} /> : null}
          {renderRow(todos[5])}
          {todos[6] ? <Spacer modifiers={[height(rowSpacing)]} /> : null}
          {renderRow(todos[6])}
          {todos[7] ? <Spacer modifiers={[height(rowSpacing)]} /> : null}
          {renderRow(todos[7])}
        </Column>
      ) : null}
      {overflowCount > 0 ? (
        <Row horizontalArrangement="end" modifiers={[fillMaxWidth()]}>
          <Text color={palette.muted} style={{ fontSize: 11 }}>
            {props.moreLabelTemplate.replace('{count}', String(overflowCount))}
          </Text>
        </Row>
      ) : null}
    </Column>
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
      maxRows: 3,
    }),
    maxRows: 3,
  },
  {
    widget: createWidget<WidgetProps>('AidoTodayLarge', AidoTodayLayout, {
      ...initialProps,
      maxRows: 8,
    }),
    maxRows: 8,
  },
];
