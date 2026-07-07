import { useTranslation } from '@src/shared/i18n';
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { ArrowLeftIcon, SettingIcon } from '@src/shared/ui';
import { getScaledFontSize } from '@src/shared/utils/font-scale';
import { router, Stack } from 'expo-router';
import { Pressable, View } from 'react-native';

const WeatherLayout = () => {
  const { t } = useTranslation('weather');
  const { fontScale } = useFontScale();
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTransparent: true,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: 'transparent' },
        headerTitleStyle: {
          fontSize: getScaledFontSize(fontScale),
          fontWeight: '600',
          color: '#FFFFFF',
        },
        headerTitleAlign: 'center',
        headerLeft: () => (
          <View className="justify-center items-center">
            <Pressable onPress={() => router.back()} hitSlop={8} className="p-2">
              <ArrowLeftIcon width={20} height={20} color="#FFFFFF" />
            </Pressable>
          </View>
        ),
        headerRight: () => (
          <View className="justify-center items-center">
            <Pressable
              onPress={() => router.push('/settings/notifications/weather')}
              hitSlop={8}
              className="p-2"
            >
              <SettingIcon width={20} height={20} color="#FFFFFF" />
            </Pressable>
          </View>
        ),
      }}
    >
      <Stack.Screen name="index" options={{ title: t('titles.index') }} />
    </Stack>
  );
};

export default WeatherLayout;
