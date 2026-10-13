import { Result, Spacing, Text, VStack } from '@src/shared/ui';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTimePalette } from '../hooks/use-time-palette';

interface WeatherMessageProps {
  title: string;
  description: string;
  action: string;
  onAction: () => unknown;
}

export function WeatherMessage({ title, description, action, onAction }: WeatherMessageProps) {
  const palette = useTimePalette();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  return (
    <VStack
      flex={1}
      align="center"
      justify="center"
      px={24}
      style={{ paddingTop: headerHeight, paddingBottom: insets.bottom }}
    >
      <Text size="b3" weight="medium" align="center" style={{ color: palette.text }}>
        {title}
      </Text>
      <Spacing size={4} />
      <Text size="b4" align="center" style={{ color: palette.textSub }}>
        {description}
      </Text>
      <Spacing size={24} />
      <Result.Button onPress={onAction}>{action}</Result.Button>
    </VStack>
  );
}
