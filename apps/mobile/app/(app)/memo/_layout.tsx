import { useTranslation } from '@src/shared/i18n';
import { useStackBackToolbar, useStackScreenOptions } from '@src/shared/ui';
import { Stack } from 'expo-router';

export default function MemoLayout() {
  const screenOptions = useStackScreenOptions({ background: 'bg-white', fillContent: true });
  const backToolbar = useStackBackToolbar();
  const { t } = useTranslation('memo');

  return (
    <Stack
      screenOptions={{
        ...screenOptions,
        animation: 'fade_from_bottom',
        animationDuration: 200,
      }}
    >
      <Stack.Screen name="create" options={{ title: t('titles.create') }} />
      <Stack.Screen name="[memoId]/index" options={{ title: '' }} />
      <Stack.Screen name="[memoId]/ai-review" options={{ title: t('titles.aiReview') }}>
        {backToolbar}
      </Stack.Screen>
    </Stack>
  );
}
