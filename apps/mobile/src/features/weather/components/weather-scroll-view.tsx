import { useRefresh } from '@src/shared/hooks/use-refresh';
import { IOS_MAJOR_VERSION } from '@src/shared/infra/device/device-info';
import { Box, StyledSafeAreaView } from '@src/shared/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { type PropsWithChildren } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOnSkyColor } from '../hooks/use-on-sky-color';
import { refetchWeather } from '../queries/weather-cache';
import { WeatherTopFade } from './weather-top-fade';

const SCREEN_GUTTER = 16;
/** 마지막 카드 아래 여백. 안전 영역과 `bottomInset`에 더한다. */
const SCREEN_BOTTOM_PADDING = 24;
/** 헤더 아래로 페이드가 이어지는 길이 */
const TOP_FADE_EXTENT = 40;
const IS_IOS = process.env.EXPO_OS === 'ios';
/** iOS 26부터는 투명 헤더 아래 내용을 시스템 스크롤 엣지 효과가 흐리므로 직접 그린 페이드를 쓰지 않는다. */
const HAS_NATIVE_EDGE_EFFECT = IOS_MAJOR_VERSION != null && IOS_MAJOR_VERSION >= 26;

interface WeatherScrollViewProps extends PropsWithChildren {
  /** 기본 아래 여백에 더할 높이 */
  bottomInset?: number;
}

export function WeatherScrollView({ children, bottomInset = 0 }: WeatherScrollViewProps) {
  const queryClient = useQueryClient();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [isRefreshing, refresh] = useRefresh(() => refetchWeather(queryClient));
  const refreshTint = useOnSkyColor('text-on-sky');

  return (
    <Box flex={1}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: IS_IOS ? 0 : headerHeight,
          paddingBottom: insets.bottom + SCREEN_BOTTOM_PADDING + bottomInset,
        }}
        refreshControl={
          <RefreshControl
            tintColor={refreshTint}
            progressViewOffset={IS_IOS ? undefined : headerHeight}
            refreshing={isRefreshing}
            onRefresh={refresh}
          />
        }
      >
        <StyledSafeAreaView edges={['left', 'right']} className="flex-1">
          {children}
        </StyledSafeAreaView>
      </ScrollView>
      {!HAS_NATIVE_EDGE_EFFECT && (
        <WeatherTopFade solidHeight={insets.top} height={headerHeight + TOP_FADE_EXTENT} />
      )}
    </Box>
  );
}

/**
 * 권한 안내·오류처럼 한 덩어리만 보여 주는 상태를 헤더 아래 보이는 영역의 세로 가운데에 둔다.
 * iOS는 헤더 높이만큼 내용이 자동으로 내려가므로 그만큼 아래 여백을 더해 가운데를 맞춘다.
 */
WeatherScrollView.Status = function Status({ children }: PropsWithChildren) {
  const headerHeight = useHeaderHeight();

  return (
    <WeatherScrollView bottomInset={IS_IOS ? headerHeight : 0}>
      <Box px={SCREEN_GUTTER} className="flex-1 justify-center">
        {children}
      </Box>
    </WeatherScrollView>
  );
};
