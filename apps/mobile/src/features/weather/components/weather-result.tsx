import { Button, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import type { ImageSource } from 'expo-image';
import type { ComponentProps, ReactNode } from 'react';
import { match } from 'ts-pattern';

import { LIGHT_BUTTON_TEXT_CLASS } from '../constants/weather-colors.constants';
import { WeatherMascot } from './weather-mascot';

interface WeatherResultProps {
  image: ImageSource | number;
  title: string;
  description?: string;
  /** 버튼 아래 한 줄 안내. 날씨 없이도 되는 일을 알려 막힌 느낌을 줄인다. */
  footnote?: string;
  children?: ReactNode;
}

/**
 * 날씨 화면의 안내·오류 상태(시안 V2States 2·6). 카드 없이 하늘 장면 위에 고양이·제목·설명과
 * 꽉 찬 폭의 버튼을 둔다. 마스코트 이미지는 장식이라 보조 기술에서 숨긴다.
 */
export function WeatherResult({
  image,
  title,
  description,
  footnote,
  children,
}: WeatherResultProps) {
  return (
    <VStack align="center" px={8}>
      <WeatherMascot source={image} className="size-[136px]" fallbackCondition="CLEAR" />
      <Text
        size="t2"
        weight="semibold"
        tone="onSky"
        align="center"
        className="mt-3.5 max-w-[280px] text-[24px] leading-[32px] tracking-[-0.7px]"
        accessibilityRole="header"
        lineBreakStrategyIOS="hangul-word"
      >
        {title}
      </Text>
      {description != null && (
        <Text
          size="b3"
          align="center"
          className="mt-2 max-w-[300px] leading-[22px] text-on-sky/80"
          lineBreakStrategyIOS="hangul-word"
        >
          {description}
        </Text>
      )}
      {children != null && <VStack className="mt-7 w-full gap-2">{children}</VStack>}
      {footnote != null && (
        <Text
          size="b4"
          align="center"
          className="mt-4 text-on-sky/60"
          lineBreakStrategyIOS="hangul-word"
          textBreakStrategy="highQuality"
        >
          {footnote}
        </Text>
      )}
    </VStack>
  );
}

type WeatherResultActionTone = 'primary' | 'light';

interface WeatherResultActionProps extends Omit<
  ComponentProps<typeof Button>,
  'variant' | 'color' | 'size' | 'display' | 'children'
> {
  tone: WeatherResultActionTone;
  children: string;
}

/** 시안의 버튼 면: 주 동작은 코랄, 다시 시도는 밝은 면. */
WeatherResult.Action = function Action({
  tone,
  children,
  className,
  ...props
}: WeatherResultActionProps) {
  return (
    <Button
      display="full"
      className={cn(
        match(tone)
          .with('primary', () => '')
          .with('light', () => 'bg-on-sky/95')
          .exhaustive(),
        className,
      )}
      {...props}
    >
      <Text
        size="b1"
        weight="semibold"
        align="center"
        className={tone === 'light' ? LIGHT_BUTTON_TEXT_CLASS : 'text-on-sky'}
      >
        {children}
      </Text>
    </Button>
  );
};
