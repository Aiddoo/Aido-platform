import { Stack } from 'expo-router';
import { useResolveClassNames } from 'uniwind';

export default function MemoLayout() {
  const bg = useResolveClassNames('bg-gray-1');

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: bg.backgroundColor as string },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="create"
        options={{ animation: 'slide_from_bottom', gestureEnabled: true }}
      />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
