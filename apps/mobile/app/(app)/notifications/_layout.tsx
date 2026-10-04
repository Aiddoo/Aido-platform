import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useTranslation } from '@src/shared/i18n';
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { ArrowLeftIcon, ScreenTitleBar, Text } from '@src/shared/ui';
import { getScaledFontSize } from '@src/shared/utils/font-scale';
import { Stack, router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';

const NotificationsLayout = () => {
  const goBack = useSingleTap(() => (router.canGoBack() ? router.back() : router.replace('/feed')));

  const headerBg = useResolveClassNames('bg-white');
  const titleColor = useResolveClassNames('text-gray-9');
  const { fontScale } = useFontScale();
  const { t } = useTranslation(['notification', 'common', 'todo']);
  const openSentNudges = useSingleTap(() => router.navigate('/nudges/sent'));

  return (
    <Stack
      screenOptions={{
        header: (props) => <ScreenTitleBar.StackHeader {...props} />,
        headerShown: true,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: headerBg.backgroundColor as string },
        headerTitleStyle: {
          fontSize: getScaledFontSize(fontScale),
          fontWeight: '600',
          color: titleColor.color as string,
        },
        headerTitleAlign: 'center',
        headerRight: () => (
          <Pressable accessibilityRole="button" onPress={openSentNudges} className="px-2 py-3">
            <Text size="b4" tone="brand" weight="medium">
              {t('todo:interaction.sent')}
            </Text>
          </Pressable>
        ),
        headerLeft: () => (
          <View className="justify-center items-center">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common:actions.goBack')}
              onPress={() => goBack()}
              hitSlop={8}
              className="p-2"
            >
              <ArrowLeftIcon width={20} height={20} colorClassName="text-gray-9" />
            </Pressable>
          </View>
        ),
      }}
    >
      <Stack.Screen name="index" options={{ title: t('titles.notifications') }} />
    </Stack>
  );
};

export default NotificationsLayout;
