import { useStackBackToolbar, useStackScreenOptions } from '@src/shared/ui';
import { Stack } from 'expo-router';

export default function TodoImportLayout() {
  const screenOptions = useStackScreenOptions({ hasContentBackground: true });
  const backToolbar = useStackBackToolbar({ fallbackHref: '/mypage' });

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index">{backToolbar}</Stack.Screen>
      <Stack.Screen name="[importId]">{backToolbar}</Stack.Screen>
    </Stack>
  );
}
