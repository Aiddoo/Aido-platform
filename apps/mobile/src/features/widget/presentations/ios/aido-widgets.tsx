import { Gauge, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  font,
  foregroundColor,
  frame,
  gaugeStyle,
  lineLimit,
  padding,
  strikethrough,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { IosWidgetProps } from './ios-widget-props';

/**
 * iOS 위젯 레이아웃 — 'widget' 디렉티브 함수는 빌드 타임에 소스 문자열로 추출되어
 * 위젯 확장의 격리된 런타임에서 실행된다. 따라서 각 함수는 모듈 스코프(임포트 값·
 * 상수·헬퍼)를 참조할 수 없고 완전히 자기완결적이어야 한다.
 * 팔레트는 widget-colors.constant.ts(WIDGET_COLORS)와 동일 값의 인라인 복사본이다.
 */

function AidoProgressLayout(props: IosWidgetProps, environment: WidgetEnvironment) {
  'widget';

  const isDark = environment.colorScheme === 'dark';
  const palette = {
    foreground: isDark ? '#F5F5F5' : '#333333',
    muted: isDark ? '#B7B7B7' : '#8F8F8F',
    brand: '#FF6B43',
  };

  if (props.state !== 'data') {
    return (
      <VStack spacing={6} modifiers={[padding({ all: 16 })]}>
        <Image systemName="pawprint.fill" size={28} modifiers={[foregroundColor(palette.brand)]} />
        <Text
          modifiers={[font({ size: 14, weight: 'semibold' }), foregroundColor(palette.foreground)]}
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
      <VStack spacing={8} modifiers={[padding({ all: 14 })]}>
        <Gauge
          value={props.completionRate}
          min={0}
          max={100}
          currentValueLabel={
            <Text
              modifiers={[font({ size: 15, weight: 'bold' }), foregroundColor(palette.foreground)]}
            >
              {`${props.completedTodos}/${props.totalTodos}`}
            </Text>
          }
          modifiers={[
            gaugeStyle('circularCapacity'),
            tint(palette.brand),
            frame({ width: 72, height: 72 }),
          ]}
        />
        <Text
          modifiers={[
            font({ size: 11, weight: 'medium' }),
            foregroundColor(props.isComplete ? palette.brand : palette.muted),
          ]}
        >
          {props.isComplete ? props.allDoneLabel : props.progressTitle}
        </Text>
        {props.currentStreak > 0 ? (
          <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundColor(palette.brand)]}>
            {`🔥 ${props.streakLabel}`}
          </Text>
        ) : null}
      </VStack>
    );
  }

  return (
    <HStack spacing={16} modifiers={[padding({ all: 16 })]}>
      <Gauge
        value={props.completionRate}
        min={0}
        max={100}
        currentValueLabel={
          <Text
            modifiers={[font({ size: 16, weight: 'bold' }), foregroundColor(palette.foreground)]}
          >
            {`${props.completedTodos}/${props.totalTodos}`}
          </Text>
        }
        modifiers={[
          gaugeStyle('circularCapacity'),
          tint(palette.brand),
          frame({ width: 76, height: 76 }),
        ]}
      />
      <VStack alignment="leading" spacing={6}>
        <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundColor(palette.muted)]}>
          {props.progressTitle}
        </Text>
        <Text modifiers={[font({ size: 22, weight: 'bold' }), foregroundColor(palette.foreground)]}>
          {props.progressLabel}
        </Text>
        <Text
          modifiers={[
            font({ size: 12, weight: 'medium' }),
            foregroundColor(props.isComplete ? palette.brand : palette.muted),
          ]}
        >
          {props.isComplete ? props.allDoneLabel : props.percentLabel}
        </Text>
        {props.currentStreak > 0 ? (
          <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundColor(palette.brand)]}>
            {`🔥 ${props.streakLabel}`}
          </Text>
        ) : null}
      </VStack>
      <Spacer />
    </HStack>
  );
}

function AidoTodayListLayout(props: IosWidgetProps, environment: WidgetEnvironment) {
  'widget';

  const isDark = environment.colorScheme === 'dark';
  const palette = {
    foreground: isDark ? '#F5F5F5' : '#333333',
    muted: isDark ? '#B7B7B7' : '#8F8F8F',
    brand: '#FF6B43',
  };

  if (props.state !== 'data') {
    return (
      <VStack spacing={6} modifiers={[padding({ all: 16 })]}>
        <Image systemName="pawprint.fill" size={28} modifiers={[foregroundColor(palette.brand)]} />
        <Text
          modifiers={[font({ size: 14, weight: 'semibold' }), foregroundColor(palette.foreground)]}
        >
          {props.stateTitle}
        </Text>
        <Text modifiers={[font({ size: 12 }), foregroundColor(palette.muted)]}>
          {props.stateCta}
        </Text>
      </VStack>
    );
  }

  const maxRows = environment.widgetFamily === 'systemLarge' ? 7 : 3;
  const visibleTodos = props.topTodos.slice(0, maxRows);

  return (
    <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 16 })]}>
      <HStack>
        <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundColor(palette.muted)]}>
          {props.progressTitle}
        </Text>
        <Spacer />
        <Text
          modifiers={[font({ size: 13, weight: 'semibold' }), foregroundColor(palette.foreground)]}
        >
          {`${props.completedTodos}/${props.totalTodos}`}
        </Text>
      </HStack>

      <Gauge
        value={props.completionRate}
        min={0}
        max={100}
        modifiers={[gaugeStyle('linearCapacity'), tint(palette.brand), frame({ height: 4 })]}
      />

      {visibleTodos.map((todo, index) => (
        <HStack key={String(index)} spacing={10}>
          <Image
            systemName={todo.completed ? 'checkmark.circle.fill' : 'circle'}
            size={18}
            modifiers={[foregroundColor(todo.completed ? palette.brand : palette.muted)]}
          />
          <Text
            modifiers={[
              font({ size: 15 }),
              foregroundColor(todo.completed ? palette.muted : palette.foreground),
              strikethrough({ isActive: todo.completed, pattern: 'solid', color: palette.muted }),
              lineLimit(1),
            ]}
          >
            {todo.title}
          </Text>
          <Spacer />
        </HStack>
      ))}

      {props.moreLabel !== '' ? (
        <Text
          modifiers={[font({ size: 11 }), foregroundColor(palette.muted), padding({ leading: 28 })]}
        >
          {props.moreLabel}
        </Text>
      ) : null}
      <Spacer />
    </VStack>
  );
}

/**
 * 위젯 인스턴스 (앱 프로세스에서 타임라인 갱신에 사용).
 * name은 app.config.ts expo-widgets 플러그인의 widgets[].name과 일치해야 한다.
 * iOS 외 플랫폼에서는 expo-widgets 스텁이 no-op으로 동작한다.
 */
export const aidoProgressWidget = createWidget<IosWidgetProps>('AidoProgress', AidoProgressLayout);
export const aidoTodayListWidget = createWidget<IosWidgetProps>(
  'AidoTodayList',
  AidoTodayListLayout,
);
