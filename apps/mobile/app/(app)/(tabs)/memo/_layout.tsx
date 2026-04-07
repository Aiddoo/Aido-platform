import { Stack } from 'expo-router';
import { useResolveClassNames } from 'uniwind';

export default function MemoLayout() {
  const bg = useResolveClassNames('bg-gray-1');

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: bg.backgroundColor as string },
        animation: 'fade',
        animationDuration: 200,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="create"
        options={{
          animation: 'fade_from_bottom',
          animationDuration: 250,
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          animation: 'fade_from_bottom',
          animationDuration: 200,
        }}
      />
    </Stack>
  );
}
