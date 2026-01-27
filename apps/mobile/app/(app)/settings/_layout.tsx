import { ArrowLeftIcon } from '@src/shared/ui/Icon';
import { router, Stack } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';

export default function SettingsLayout() {
  const headerBg = useResolveClassNames('bg-gray-1');
  const titleColor = useResolveClassNames('text-gray-9');

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: headerBg.backgroundColor as string },
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '600',
          color: titleColor.color as string,
        },
        headerTitleAlign: 'center',
        headerLeft: () => (
          <View className="justify-center items-center">
            <Pressable onPress={() => router.back()} hitSlop={8} className="p-2">
              <ArrowLeftIcon width={20} height={20} colorClassName="text-gray-9" />
            </Pressable>
          </View>
        ),
      }}
    >
      <Stack.Screen name="notifications" options={{ title: '알림 설정' }} />
      <Stack.Screen name="terms" options={{ title: '약관 및 정책' }} />
    </Stack>
  );
}
