import { useTranslation } from '@src/shared/i18n';
import { useStackBackToolbar, useStackScreenOptions } from '@src/shared/ui';
import { Stack } from 'expo-router';

function ReportsLayout() {
  const screenOptions = useStackScreenOptions({ fillContent: true });
  const backToolbar = useStackBackToolbar();
  const { t } = useTranslation('ai');

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: t('titles.reports') }}>
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen name="[id]" options={{ title: '' }}>
        {backToolbar}
      </Stack.Screen>
    </Stack>
  );
}

export default ReportsLayout;
