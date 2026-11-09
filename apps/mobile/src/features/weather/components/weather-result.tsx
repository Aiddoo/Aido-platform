import { Button, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import type { ImageSource } from 'expo-image';
import type { ComponentProps, ReactNode } from 'react';

import { LIGHT_BUTTON_TEXT_CLASS } from '../constants/weather-colors.constants';
import { WeatherMascot } from './weather-mascot';

interface WeatherResultProps {
  image: ImageSource | number;
  title: string;
  description?: string;
  children?: ReactNode;
}

/** 시안 V2States 2·6. 마스코트 이미지는 장식이라 보조 기술에서 숨긴다 */
export function WeatherResult({ image, title, description, children }: WeatherResultProps) {
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
    </VStack>
  );
}

interface WeatherResultActionProps extends Omit<
  ComponentProps<typeof Button>,
  'variant' | 'color' | 'size' | 'display' | 'children'
> {
  children: string;
}

/** 하늘 위 다시 시도 버튼은 밝은 면이다 */
WeatherResult.Action = function Action({
  children,
  className,
  ...props
}: WeatherResultActionProps) {
  return (
    <Button display="full" className={cn('bg-on-sky/95', className)} {...props}>
      <Text size="b1" weight="semibold" align="center" className={LIGHT_BUTTON_TEXT_CLASS}>
        {children}
      </Text>
    </Button>
  );
};
