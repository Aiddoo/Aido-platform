import { useTranslation } from '@src/shared/i18n';
import { useStackBackToolbar, useStackScreenOptions } from '@src/shared/ui';
import { Stack } from 'expo-router';

function AchievementsLayout() {
  const screenOptions = useStackScreenOptions({ fillContent: true });
  const backToolbar = useStackBackToolbar();
  const { t } = useTranslation('achievement');

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: t('titles.index') }}>
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen name="[year]/[week]" options={{ title: t('titles.detail') }}>
        {backToolbar}
      </Stack.Screen>
    </Stack>
  );
}

export default AchievementsLayout;
