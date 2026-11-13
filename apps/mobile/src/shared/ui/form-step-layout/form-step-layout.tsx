import { ANIMATION } from '@src/shared/constants/animation';
import type { ComponentProps, ReactNode } from 'react';
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
  children: ReactNode;
}

export function FormStepLayout({
  title,
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
