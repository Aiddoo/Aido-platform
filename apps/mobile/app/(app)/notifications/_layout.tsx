import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { ArrowLeftIcon, Text, useStackScreenOptions } from '@src/shared/ui';
import { Stack, router } from 'expo-router';
import { Pressable } from 'react-native';

function NotificationsLayout() {
  const screenOptions = useStackScreenOptions({ background: 'bg-white' });
  const { t } = useTranslation(['notification', 'common', 'todo']);
  const goHome = useSingleTap(() => router.replace('/feed'));
  const openSentNudges = useSingleTap(() => router.navigate('/nudges/sent'));

  return (
    <Stack
      screenOptions={{
        ...screenOptions,
        headerRight: () => (
          <Pressable accessibilityRole="button" onPress={openSentNudges} className="px-2 py-3">
            <Text size="b4" tone="brand" weight="medium">
              {t('todo:interaction.sent')}
            </Text>
          </Pressable>
        ),
        headerLeft: ({ canGoBack }) =>
          canGoBack ? undefined : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common:actions.goBack')}
              onPress={() => goHome()}
              hitSlop={8}
              className="size-11 items-center justify-center rounded-full"
            >
              <ArrowLeftIcon width={22} height={22} colorClassName="text-gray-9" />
            </Pressable>
          ),
      }}
    >
      <Stack.Screen name="index" options={{ title: t('titles.notifications') }} />
    </Stack>
  );
}

export default NotificationsLayout;
