import { useTranslation } from '@src/shared/i18n';
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { ArrowLeftIcon } from '@src/shared/ui';
import { getScaledFontSize } from '@src/shared/utils/font-scale';
import { router, Stack } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';

export default function SettingsLayout() {
  const headerBg = useResolveClassNames('bg-gray-1');
  const titleColor = useResolveClassNames('text-gray-9');
  const { fontScale } = useFontScale();
  const { t } = useTranslation('settings');

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
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="theme" options={{ title: t('titles.theme') }} />
      <Stack.Screen name="font-size" options={{ title: t('titles.fontSize') }} />
      <Stack.Screen name="language" options={{ title: t('titles.language') }} />
      <Stack.Screen name="terms" options={{ title: t('titles.terms') }} />
      <Stack.Screen name="inquiry" options={{ title: t('titles.inquiry') }} />
      <Stack.Screen name="linked-accounts" options={{ title: t('titles.linkedAccounts') }} />
      <Stack.Screen name="app-icon" options={{ title: t('titles.appIcon') }} />
      <Stack.Screen name="profile" options={{ title: t('titles.profile') }} />
      <Stack.Screen name="edit-name" options={{ title: t('titles.editName') }} />
      <Stack.Screen name="change-password" options={{ title: t('titles.changePassword') }} />
      <Stack.Screen name="delete-account" options={{ title: t('titles.deleteAccount') }} />
      <Stack.Screen name="subscription" options={{ title: t('titles.subscription') }} />
      <Stack.Screen name="category-settings" options={{ title: t('titles.categorySettings') }} />
    </Stack>
  );
}
