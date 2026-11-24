import { ANIMATION } from '@src/shared/constants/animation';
import type { ComponentProps, ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { StyledSafeAreaView } from '../styled-safe-area-view/styled-safe-area-view';
import { H3 } from '../text/typography';
import { FormScrollView } from './form-scroll-view';

export interface FormStepLayoutProps extends Omit<
  ComponentProps<typeof FormScrollView>,
  'children'
> {
  /** 단계 제목. 바뀌면 제목만 다시 페이드인한다. */
  title: string;
  /** 제목 위 진행 표시(`Steps.Dots`). 스크롤 안 같은 흐름에 둬 넓은 화면·큰 글자에서도 제목과 겹치지 않는다 */
  progress?: ReactNode;
  children: ReactNode;
}

export function FormStepLayout({
  title,
  progress,
  children,
  contentContainerStyle,
  ...props
}: FormStepLayoutProps) {
  return (
    <FormScrollView
      contentContainerStyle={[
        {
          paddingHorizontal: 16,
          paddingTop: 24,
          paddingBottom: 24,
        },
        contentContainerStyle,
      ]}
      {...props}
    >
      <StyledSafeAreaView edges={['left', 'right']}>
        {progress != null && <View style={{ marginBottom: 16 }}>{progress}</View>}
        <Animated.View
          key={title}
          entering={FadeIn.duration(ANIMATION.durationMs.slow)}
          style={{ marginBottom: 24 }}
        >
          <H3>{title}</H3>
        </Animated.View>

        {children}
      </StyledSafeAreaView>
    </FormScrollView>
  );
}
