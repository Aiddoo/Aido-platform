import { useTranslation } from '@src/shared/i18n';
import { useStackBackToolbar, useStackScreenOptions } from '@src/shared/ui';
import { Stack } from 'expo-router';

export default function NudgeLayout() {
  const screenOptions = useStackScreenOptions({ background: 'bg-background' });
  const backToolbar = useStackBackToolbar({ fallbackHref: '/notifications' });
  const { t } = useTranslation('todo');

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="[nudgeId]" options={{ title: t('interaction.detailTitle') }}>
        {backToolbar}
      </Stack.Screen>
    </Stack>
  );
}
