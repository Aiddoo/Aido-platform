import { useStackScreenOptions } from '@src/shared/ui';
import { Stack } from 'expo-router';

export default function MyPageLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={{ ...screenOptions, title: '' }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
