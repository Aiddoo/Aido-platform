import { ANIMATION } from '@src/shared/constants/animation.constants';
import { cn } from '@src/shared/utils/cn';
import type { ComponentProps, ReactNode } from 'react';
import { ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { StyledSafeAreaView } from '../safe-area-view';
import { H3 } from '../text';

export interface FormStepLayoutProps extends Omit<ComponentProps<typeof ScrollView>, 'children'> {
  /** 단계 제목. 바뀌면 제목만 다시 페이드인한다. */
  title: string;
  children: ReactNode;
}

/** 폼 단계 화면의 스크롤 영역 — 가로 safe area, 페이드인 제목, 입력 영역 순서로 놓는다. */
export function FormStepLayout({
  title,
  children,
  className,
  contentContainerStyle,
  ...props
}: FormStepLayoutProps) {
  return (
    <ScrollView
      className={cn('flex-1', className)}
      contentContainerStyle={[
        { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 100 },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...props}
    >
      <StyledSafeAreaView edges={['left', 'right']}>
        <Animated.View
          key={title}
          entering={FadeIn.duration(ANIMATION.duration.slow)}
          style={{ marginBottom: 24 }}
        >
          <H3>{title}</H3>
        </Animated.View>

        {children}
      </StyledSafeAreaView>
    </ScrollView>
  );
}
