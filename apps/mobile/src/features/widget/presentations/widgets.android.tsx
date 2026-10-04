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
  const isSmallWidget = props.maxRows === 0;
  const isLargeWidget = props.maxRows > 3;
  const defaultWidth = isSmallWidget ? 160 : 340;
  const defaultHeight = isSmallWidget || !isLargeWidget ? 160 : 380;
  const resolveDimension = (dimension: number | undefined, fallback: number) =>
    dimension != null && Number.isFinite(dimension) && dimension > 0 ? dimension : fallback;
  const widgetWidth = resolveDimension(environment.widgetSize?.width, defaultWidth);
  const widgetHeight = resolveDimension(environment.widgetSize?.height, defaultHeight);
  const cardHeight = Math.min(
    widgetHeight,
    widgetWidth / (isSmallWidget ? 1 : isLargeWidget ? 0.97 : 2.05),
  );
  const layoutScale = Math.min(1, widgetWidth / defaultWidth, cardHeight / defaultHeight);
  const scaled = (value: number) => value * layoutScale;
  const contentPadding = scaled(isSmallWidget ? 28 : 32);
  const contentWidth = widgetWidth - contentPadding * 2;
  const countDigitCount = String(props.completedTodos).length + String(props.totalTodos).length;
  const countFontScale = Math.min(1, 4 / countDigitCount);

  const renderSurface = (children: ReactNode) => (
    <Box contentAlignment="center" modifiers={[fillMaxSize()]}>
      <Box
        modifiers={[
          fillMaxWidth(),
          height(cardHeight),
          background(palette.background),
          cornerRadius(scaled(20)),
          paddingAll(contentPadding),
        ]}
      >
        {children}
      </Box>
    </Box>
  );

  const renderPaw = () => (
    <Image
      source={{ uri: 'aido_widget_paw' }}
      tint={palette.brand}
      contentDescription={null}
      modifiers={[size(scaled(24), scaled(20))]}
    />
  );

  if (
    props.state === 'loggedOut' ||
    props.state === 'stale' ||
    isStale ||
    (props.state === 'empty' && props.maxRows === 0)
  ) {
    return renderSurface(
      <Column horizontalAlignment="center" verticalArrangement="center" modifiers={[fillMaxSize()]}>
        {renderPaw()}
        <Spacer modifiers={[height(scaled(6))]} />
        <Text
          color={palette.foreground}
          style={{ fontSize: scaled(14), fontWeight: '600' }}
          maxLines={2}
        >
          {isStale ? props.staleTitle : props.stateTitle}
        </Text>
        <Spacer modifiers={[height(scaled(6))]} />
        <Text color={palette.muted} style={{ fontSize: scaled(12) }} maxLines={2}>
          {isStale ? props.staleCta : props.stateCta}
        </Text>
      </Column>,
    );
  }

  if (props.maxRows === 0) {
    return renderSurface(
      <Column verticalArrangement="center" modifiers={[fillMaxSize()]}>
        <Box modifiers={[fillMaxWidth()]} contentAlignment="centerStart">
          <Text
            color={palette.muted}
            style={{ fontSize: scaled(12), fontWeight: '500' }}
            modifiers={[fillMaxWidth()]}
          >
            {props.progressTitle}
          </Text>
          <Box modifiers={[fillMaxWidth()]} contentAlignment="centerEnd">
            {renderPaw()}
          </Box>
        </Box>
        <Spacer modifiers={[height(scaled(8))]} />
        <Row verticalAlignment="bottom">
          <Text
            color={palette.brand}
            style={{ fontSize: scaled(34) * countFontScale, fontWeight: 'bold' }}
            maxLines={1}
          >
            {props.completedTodos}
          </Text>
          <Text
            color={palette.muted}
            style={{ fontSize: scaled(18) * countFontScale, fontWeight: '600' }}
            maxLines={1}
          >{`/${props.totalTodos}`}</Text>
        </Row>
        <Spacer modifiers={[height(scaled(8))]} />
        <LinearProgressIndicator
          progress={props.completionRate / 100}
          color={palette.brand}
          trackColor={palette.track}
          modifiers={[fillMaxWidth(), height(scaled(6))]}
        />
        <Spacer modifiers={[height(scaled(8))]} />
        <Box modifiers={[fillMaxWidth()]} contentAlignment="centerStart">
          <Text
            color={props.isComplete ? palette.brand : palette.muted}
            style={{ fontSize: scaled(11), fontWeight: '500' }}
            maxLines={1}
            modifiers={[fillMaxWidth()]}
          >
            {props.isComplete ? props.allDoneLabel : props.percentLabel}
          </Text>
          {props.currentStreak > 0 ? (
            <Text
              color={palette.brand}
              style={{ fontSize: scaled(11), fontWeight: '500', textAlign: 'end' }}
              maxLines={1}
              modifiers={[fillMaxWidth()]}
            >{`🔥 ${props.compactStreakLabel}`}</Text>
          ) : null}
        </Box>
      </Column>,
    );
  }

  const visibleTodos = props.topTodos.slice(0, isLargeWidget ? 4 : 2);
  const hiddenTodoCount = Math.max(0, props.totalTodos - visibleTodos.length);
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
    return renderAppLink(
      todo.destination,
      <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
        <Box
          contentAlignment="center"
          modifiers={[
            size(scaled(16), scaled(16)),
            background(todo.color),
            cornerRadius(scaled(5)),
          ]}
        >
          {!todo.completed ? (
            <Box
              modifiers={[
                size(scaled(12), scaled(12)),
                background(palette.background),
                cornerRadius(scaled(3)),
              ]}
            />
          ) : null}
          {todo.completed ? (
            <Text color="#FFFFFF" style={{ fontSize: scaled(10), fontWeight: 'bold' }}>
              ✓
            </Text>
          ) : null}
        </Box>
        <Spacer modifiers={[width(scaled(8))]} />
        <Text
          color={todo.completed ? palette.muted : palette.foreground}
          style={{ fontSize: scaled(13), textDecoration: todo.completed ? 'lineThrough' : 'none' }}
          maxLines={1}
          overflow="ellipsis"
        >
          {todo.title}
        </Text>
      </Row>,
      scaled(isLargeWidget ? 29 : 30),
    );
  };

  const renderAddTodo = () => {
    const linkProps: ComponentProps<typeof Button> & { target?: string } = {
      target: props.addTodoUrl ?? props.openAppUrl ?? '__aido_widget_open_app',
      colors: { containerColor: palette.brandSurface, contentColor: palette.brand },
      contentPadding: { start: scaled(10), top: scaled(6), end: scaled(10), bottom: scaled(6) },
      modifiers: [cornerRadius(scaled(9)), height(scaled(28))],
      children: (
        <Row verticalAlignment="center">
          <Text
            color={palette.brand}
            style={{ fontSize: scaled(12), fontWeight: '600' }}
            maxLines={1}
            overflow="ellipsis"
          >{`＋ ${props.addTodoLabel ?? props.stateCta}`}</Text>
        </Row>
      ),
    };
    return <Button {...linkProps} />;
  };

  if (!isLargeWidget) {
    return renderSurface(
      <Box modifiers={[fillMaxSize()]}>
        <Row verticalAlignment="center" modifiers={[width(scaled(99)), fillMaxHeight()]}>
          <Column modifiers={[width(scaled(82))]}>
            <Text
              color={palette.muted}
              style={{ fontSize: scaled(11), fontWeight: '500' }}
              maxLines={1}
            >
              {props.progressTitle}
            </Text>
            <Spacer modifiers={[height(scaled(4))]} />
            <Row verticalAlignment="bottom">
              <Text
                color={palette.brand}
                style={{ fontSize: scaled(32) * countFontScale, fontWeight: 'bold' }}
                maxLines={1}
              >
                {props.completedTodos}
              </Text>
              <Text
                color={palette.muted}
                style={{ fontSize: scaled(17) * countFontScale, fontWeight: '600' }}
                maxLines={1}
              >{`/${props.totalTodos}`}</Text>
            </Row>
            <Spacer modifiers={[height(scaled(6))]} />
            <LinearProgressIndicator
              progress={props.completionRate / 100}
              color={palette.brand}
              trackColor={palette.track}
              modifiers={[fillMaxWidth(), height(scaled(4))]}
            />
            <Spacer modifiers={[height(scaled(6))]} />
            <Row verticalAlignment="center">
              {renderPaw()}
              <Spacer modifiers={[width(scaled(4))]} />
              <Text color={palette.brand} style={{ fontSize: scaled(11) }} maxLines={1}>
                {props.currentStreak > 0 ? props.compactStreakLabel : props.percentLabel}
              </Text>
            </Row>
          </Column>
          <Spacer modifiers={[width(scaled(16))]} />
          <Box modifiers={[width(scaled(1)), fillMaxHeight(), background(palette.track)]} />
        </Row>
        <Column
          verticalArrangement="center"
          modifiers={[fillMaxSize(), padding(scaled(115), 0, 0, 0)]}
        >
          {props.state === 'empty' ? (
            <Box contentAlignment="centerStart" modifiers={[fillMaxWidth(), height(scaled(56))]}>
              <Text color={palette.muted} style={{ fontSize: scaled(12) }} maxLines={2}>
                {props.stateTitle}
              </Text>
            </Box>
          ) : (
            <Column modifiers={[fillMaxWidth()]}>
              {renderTodoRow(visibleTodos[0])}
              {visibleTodos[1] ? <Spacer modifiers={[height(scaled(4))]} /> : null}
              {renderTodoRow(visibleTodos[1])}
            </Column>
          )}
          <Spacer modifiers={[height(scaled(4))]} />
          {renderAddTodo()}
        </Column>
      </Box>,
    );
  }

  const renderWeekDay = (day?: NonNullable<WidgetProps['weekDays']>[number], index = 0) => {
    if (!day) return null;
    const linkProps: ComponentProps<typeof Button> & { target: string } = {
      target: day.destination,
      colors: transparentButtonColors,
      contentPadding: zeroContentPadding,
      modifiers: [width(contentWidth / 7), height(scaled(64))],
      children: (
        <Column horizontalAlignment="center">
          <Text
            color={index === 0 ? '#FF5858' : index === 6 ? '#2598E8' : palette.muted}
            style={{ fontSize: scaled(10) }}
          >
            {day.weekdayLabel}
          </Text>
          <Spacer modifiers={[height(scaled(4))]} />
          <Box
            contentAlignment="center"
            modifiers={[
              size(scaled(28), scaled(28)),
              cornerRadius(scaled(14)),
              background(day.isToday ? palette.brand : 'transparent'),
            ]}
          >
            <Text
              color={day.isToday ? '#FFFFFF' : palette.foreground}
              style={{ fontSize: scaled(14), fontWeight: day.isToday ? 'bold' : '500' }}
            >
              {day.dayLabel}
            </Text>
          </Box>
          <Spacer modifiers={[height(scaled(4))]} />
          {day.isComplete ? (
            <Image
              source={{ uri: 'aido_widget_paw' }}
              tint={palette.brand}
              contentDescription={null}
              modifiers={[size(scaled(16), scaled(13))]}
            />
          ) : (
            <Text color={palette.brand} style={{ fontSize: scaled(11) }}>
              {day.hasTodos ? '•' : ' '}
            </Text>
          )}
        </Column>
      ),
    };
    return <Button {...linkProps} />;
  };
  const weekDays = props.weekDays ?? [];

  const footerHeight = scaled(38);
  const bodyHeight = scaled(266);
  const footerSpacing = Math.max(
    scaled(8),
    cardHeight - contentPadding * 2 - bodyHeight - footerHeight,
  );

  return renderSurface(
    <Column modifiers={[fillMaxSize()]}>
      <Column modifiers={[fillMaxWidth()]}>
        <Box contentAlignment="centerStart" modifiers={[fillMaxWidth(), height(scaled(24))]}>
          <Row
            verticalAlignment="center"
            modifiers={[fillMaxWidth(), padding(0, 0, scaled(100), 0)]}
          >
            <Text
              color={palette.foreground}
              style={{
                fontSize: scaled((props.weekTitle?.length ?? 0) > 18 ? 12 : 14),
                fontWeight: '600',
              }}
              maxLines={1}
              overflow="ellipsis"
            >
              {props.weekTitle ?? props.progressTitle}
            </Text>
            <Spacer modifiers={[width(scaled(4))]} />
            {renderPaw()}
          </Row>
          {props.weekRangeLabel ? (
            <Text
              color={palette.muted}
              style={{ fontSize: scaled(10), textAlign: 'end' }}
              maxLines={1}
              modifiers={[fillMaxWidth()]}
            >
              {props.weekRangeLabel}
            </Text>
          ) : null}
        </Box>
        <Spacer modifiers={[height(scaled(8))]} />
        <Row modifiers={[fillMaxWidth()]}>
          {renderWeekDay(weekDays[0], 0)}
          {renderWeekDay(weekDays[1], 1)}
          {renderWeekDay(weekDays[2], 2)}
          {renderWeekDay(weekDays[3], 3)}
          {renderWeekDay(weekDays[4], 4)}
          {renderWeekDay(weekDays[5], 5)}
          {renderWeekDay(weekDays[6], 6)}
        </Row>
      </Column>
      <Spacer modifiers={[height(scaled(8))]} />
      <Column modifiers={[fillMaxWidth()]}>
        <Box contentAlignment="centerStart" modifiers={[fillMaxWidth(), height(scaled(26))]}>
          <Text color={palette.muted} style={{ fontSize: scaled(12) }}>
            {props.progressTitle}
          </Text>
          <Box contentAlignment="centerEnd" modifiers={[fillMaxWidth()]}>
            <Row verticalAlignment="bottom">
              <Text
                color={palette.brand}
                style={{ fontSize: scaled(16) * countFontScale, fontWeight: 'bold' }}
                maxLines={1}
              >
                {props.completedTodos}
              </Text>
              <Text
                color={palette.muted}
                style={{ fontSize: scaled(12) * countFontScale, fontWeight: '600' }}
                maxLines={1}
              >
                {`/${props.totalTodos}`}
              </Text>
            </Row>
          </Box>
        </Box>
        <Spacer modifiers={[height(scaled(8))]} />
        <LinearProgressIndicator
          progress={props.completionRate / 100}
          color={palette.brand}
          trackColor={palette.track}
          modifiers={[fillMaxWidth(), height(scaled(4))]}
        />
      </Column>
      <Spacer modifiers={[height(scaled(8))]} />
      <Column modifiers={[fillMaxWidth(), height(scaled(116))]}>
        {props.state === 'empty' ? (
          <Box contentAlignment="centerStart" modifiers={[fillMaxSize()]}>
            <Text color={palette.muted} style={{ fontSize: scaled(13) }} maxLines={2}>
              {props.stateTitle}
            </Text>
          </Box>
        ) : null}
        {renderTodoRow(visibleTodos[0])}
        {renderTodoRow(visibleTodos[1])}
        {renderTodoRow(visibleTodos[2])}
        {renderTodoRow(visibleTodos[3])}
      </Column>
      <Spacer modifiers={[height(footerSpacing)]} />
      <Column modifiers={[fillMaxWidth()]}>
        <Box modifiers={[fillMaxWidth(), height(scaled(1)), background(palette.track)]} />
        <Spacer modifiers={[height(scaled(8))]} />
        <Box contentAlignment="centerStart" modifiers={[fillMaxWidth(), height(scaled(28))]}>
          <Text
            color={palette.muted}
            style={{ fontSize: scaled(10) }}
            maxLines={1}
            overflow="ellipsis"
            modifiers={[fillMaxWidth(), padding(0, 0, scaled(118), 0)]}
          >
            {hiddenTodoCount > 0
              ? props.moreLabelTemplate.replace('{count}', String(hiddenTodoCount))
              : (props.openTodoLabel ?? '')}
          </Text>
          <Box contentAlignment="centerEnd" modifiers={[fillMaxWidth()]}>
            {renderAddTodo()}
          </Box>
        </Box>
      </Column>
    </Column>,
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
