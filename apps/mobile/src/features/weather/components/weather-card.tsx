import { Box, HStack, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { times } from 'es-toolkit/compat';
import { GlassView } from 'heroui-native';
import { type ComponentProps, type ReactNode, useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useUniwind } from 'uniwind';

const GLASS_INTENSITY = 30;

interface WeatherCardProps extends Omit<ComponentProps<typeof GlassView>, 'children'> {
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
}

/**
 * 하늘 장면 위에 놓이는 어두운 유리 카드. 글자는 늘 흰색이라 테마와 무관하게 어두운 면을 쓴다.
 * 블러가 없는 Android와 투명도 줄이기 설정에서는 같은 톤의 불투명 면으로 그린다.
 */
export function WeatherCard({ title, icon, children, ...props }: WeatherCardProps) {
  const { theme } = useUniwind();
  const shouldUseOpaqueGlass = useReduceTransparency();

  return (
    <Box className="overflow-hidden rounded-[22px]">
      <GlassView
        intensity={GLASS_INTENSITY}
        tint="dark"
        fallbackColor={theme === 'dark' ? 'overlay' : 'background-inverse'}
        forceFallbackColor={shouldUseOpaqueGlass}
        {...props}
      />
      <VStack gap={10} px={16} py={14} className="bg-black/10">
        {title != null && (
          <HStack gap={6} align="center" accessibilityRole="header">
            {icon}
            <Text size="e1" weight="semibold" className="text-white/70" maxLines={1}>
              {title}
            </Text>
          </HStack>
        )}
        {children}
      </VStack>
    </Box>
  );
}

WeatherCard.Loading = function Loading({ lines = 2 }: { lines?: number }) {
  return (
    <WeatherCard>
      <TextSkeleton size="e1" className="w-24 opacity-40" />
      {times(lines, (index) => (
        <TextSkeleton key={index} size="b2" className="w-full opacity-40" />
      ))}
    </WeatherCard>
  );
};

let isReduceTransparencyEnabled = false;

/** 투명도 줄이기의 첫 값은 비동기로만 읽을 수 있어, 구독을 시작할 때 읽고 바뀌면 다시 그린다. */
function subscribeReduceTransparency(onChange: () => void) {
  const update = (isEnabled: boolean) => {
    isReduceTransparencyEnabled = isEnabled;
    onChange();
  };
  AccessibilityInfo.isReduceTransparencyEnabled()
    .then(update)
    .catch(() => undefined);
  const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', update);
  return () => subscription.remove();
}

function getReduceTransparencySnapshot() {
  return isReduceTransparencyEnabled;
}

function useReduceTransparency(): boolean {
  return useSyncExternalStore(subscribeReduceTransparency, getReduceTransparencySnapshot);
}
