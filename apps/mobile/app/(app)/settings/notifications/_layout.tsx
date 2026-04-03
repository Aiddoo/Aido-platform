import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { ArrowLeftIcon } from '@src/shared/ui';
import { getScaledFontSize } from '@src/shared/utils/font-scale';
import { router, Stack } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';

export default function NotificationsLayout() {
  const headerBg = useResolveClassNames('bg-gray-1');
  const titleColor = useResolveClassNames('text-gray-9');
  const { fontScale } = useFontScale();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: headerBg.backgroundColor as string },
        headerTitleStyle: {
          fontSize: getScaledFontSize(fontScale),
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
      <Stack.Screen name="index" options={{ title: '알림 설정' }} />
      <Stack.Screen name="push" options={{ title: '푸시 알림' }} />
      <Stack.Screen name="weather" options={{ title: '날씨 알림' }} />
      <Stack.Screen name="reminder" options={{ title: '리마인드 알림' }} />
    </Stack>
  );
}
