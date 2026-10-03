import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useTranslation } from '@src/shared/i18n';
import { type NativeStackHeaderProps, router } from 'expo-router';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { StyleSheet } from 'react-native';

import { HStack } from '../HStack/HStack';
import { ArrowLeftIcon } from '../Icon';
import { StyledSafeAreaView } from '../SafeAreaView';
import { Text } from '../Text/Text';
import { VStack } from '../VStack/VStack';
import type { ScreenTitleBarProps } from './ScreenTitleBar.types';

/**
 * 화면 최상단 고정 바 — 뒤로가기 · 가운데 제목 · 오른쪽 액션.
 * 네이티브 헤더로는 못 그리는 실시간 값(조회수 등)을 subtitle에 둘 수 있다.
 */
export function ScreenTitleBar({
  title,
  leading,
  subtitle,
  trailing,
  onBackPress,
  backAccessibilityLabel,
  isBackDisabled = false,
}: ScreenTitleBarProps) {
  const { t } = useTranslation('common');
  const goBack = useSingleTap(router.back);

  return (
    <HStack px={16} py={10} align="center" justify="between">
      {leading !== undefined ? (
        leading
      ) : (
        <PressableFeedback
          onPress={onBackPress ?? (() => goBack())}
          isDisabled={isBackDisabled}
          hitSlop={8}
          className="size-11 items-center justify-center rounded-full"
          accessibilityRole="button"
          accessibilityLabel={backAccessibilityLabel ?? t('actions.goBack')}
          accessibilityState={{ disabled: isBackDisabled }}
        >
          <ArrowLeftIcon width={22} height={22} colorClassName="text-gray-9" />
        </PressableFeedback>
      )}

      <VStack align="center" gap={1}>
        <Text size="b2" weight="bold">
          {title}
        </Text>
        {subtitle !== undefined && (
          <Text size="e1" shade={5}>
            {subtitle}
          </Text>
        )}
      </VStack>

      {/* 오른쪽이 비어도 제목이 가운데에 남도록 같은 폭을 차지한다. */}
      {trailing ?? <HStack className="size-11" />}
    </HStack>
  );
}

ScreenTitleBar.StackHeader = function StackHeader({
  options,
  navigation,
  back,
}: NativeStackHeaderProps) {
  const canGoBack = navigation.canGoBack();
  const headerStyle = StyleSheet.flatten(options.headerStyle);
  const buttonProps = {
    canGoBack,
    tintColor: options.headerTintColor,
    backgroundColor: headerStyle?.backgroundColor,
  };

  return (
    <StyledSafeAreaView edges={['top']} className="bg-white" style={headerStyle}>
      <ScreenTitleBar
        title={
          typeof options.headerTitle === 'string' ? options.headerTitle : (options.title ?? '')
        }
        leading={
          options.headerLeft ? (
            options.headerLeft({ ...buttonProps, label: back?.title, href: back?.href })
          ) : back ? undefined : (
            <HStack className="size-11" />
          )
        }
        trailing={options.headerRight?.(buttonProps)}
        onBackPress={() => navigation.goBack()}
      />
    </StyledSafeAreaView>
  );
};

/** 제목이 서버 값에 기대는 경우의 자리표시 */
ScreenTitleBar.Loading = function Loading({ hasSubtitle = false }: { hasSubtitle?: boolean }) {
  return (
    <HStack px={16} py={10} align="center" justify="between">
      <HStack className="size-11" />
      <VStack align="center" gap={4}>
        <Skeleton className="h-5 w-16 rounded" />
        {hasSubtitle && <Skeleton className="h-3 w-12 rounded" />}
      </VStack>
      <HStack className="size-11" />
    </HStack>
  );
};
