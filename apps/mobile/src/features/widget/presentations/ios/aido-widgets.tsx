import { Gauge, HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  font,
  foregroundColor,
  frame,
  gaugeStyle,
  lineLimit,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { IosWidgetProps } from './ios-widget-props';

/**
 * 오늘 할 일 위젯 — 단일 레이아웃이 3개 패밀리를 담당한다.
 *
 * - systemSmall: 컴팩트 진행 요약 (카운트 히어로 + 선형 바 + 스트릭)
 * - systemMedium: 헤더 + 상위 3개 할 일 (카테고리 컬러 체크)
 * - systemLarge: 헤더 + 상위 8개 할 일
 *
 * 'widget' 디렉티브 함수는 빌드 타임에 소스 문자열로 추출되어 위젯 확장의
 * 격리된 런타임에서 실행된다 — 모듈 스코프(임포트 값·상수·헬퍼) 참조 금지,
 * 팔레트는 widget-colors.constant.ts와 동일 값의 인라인 복사본이다.
 * 프리미티브는 시뮬레이터에서 렌더가 검증된 것만 사용한다
 * (Text/HStack/VStack/Spacer/선형 Gauge — 링 중앙 라벨·strikethrough는 미렌더 확인됨).
 */
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
        <Text modifiers={[font({ size: 24 })]}>🐾</Text>
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
      <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 14 })]}>
        <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundColor(palette.muted)]}>
          {props.progressTitle}
        </Text>
        <Text modifiers={[font({ size: 32, weight: 'bold' }), foregroundColor(palette.foreground)]}>
          {`${props.completedTodos}/${props.totalTodos}`}
        </Text>
        <Gauge
          value={props.completionRate}
          min={0}
          max={100}
          modifiers={[gaugeStyle('linearCapacity'), tint(palette.brand), frame({ height: 6 })]}
        />
        <Text
          modifiers={[
            font({ size: 11, weight: 'medium' }),
            foregroundColor(props.isComplete ? palette.brand : palette.muted),
          ]}
        >
          {props.isComplete ? props.allDoneLabel : props.percentLabel}
        </Text>
        {props.currentStreak > 0 ? (
          <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundColor(palette.brand)]}>
            {`🔥 ${props.streakLabel}`}
          </Text>
        ) : null}
      </VStack>
    );
  }

  const maxRows = environment.widgetFamily === 'systemLarge' ? 8 : 3;
  const visibleTodos = props.topTodos.slice(0, maxRows);
  const overflowCount = props.totalTodos - visibleTodos.length;

  return (
    <VStack alignment="leading" spacing={7} modifiers={[padding({ all: 16 })]}>
      <HStack>
        <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundColor(palette.muted)]}>
          {props.progressTitle}
        </Text>
        <Spacer />
        <Text
          modifiers={[
            font({ size: 13, weight: 'semibold' }),
            foregroundColor(props.isComplete ? palette.brand : palette.foreground),
          ]}
        >
          {props.isComplete ? props.allDoneLabel : `${props.completedTodos}/${props.totalTodos}`}
        </Text>
      </HStack>

      <Gauge
        value={props.completionRate}
        min={0}
        max={100}
        modifiers={[gaugeStyle('linearCapacity'), tint(palette.brand), frame({ height: 4 })]}
      />

      {visibleTodos.map((todo, index) => (
        <HStack key={String(index)} spacing={9}>
          <Text modifiers={[font({ size: 14, weight: 'bold' }), foregroundColor(todo.color)]}>
            {todo.completed ? '✓' : '○'}
          </Text>
          <Text
            modifiers={[
              font({ size: 15 }),
              foregroundColor(todo.completed ? palette.muted : palette.foreground),
              lineLimit(1),
            ]}
          >
            {todo.title}
          </Text>
          <Spacer />
        </HStack>
      ))}

      {overflowCount > 0 && props.moreLabel !== '' ? (
        <Text modifiers={[font({ size: 11 }), foregroundColor(palette.muted)]}>
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
export const aidoTodayListWidget = createWidget<IosWidgetProps>(
  'AidoTodayList',
  AidoTodayListLayout,
);
