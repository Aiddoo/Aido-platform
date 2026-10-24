import { useTranslation } from '@src/shared/i18n';
import { useStackScreenOptions } from '@src/shared/ui';
import { Stack } from 'expo-router';

function AchievementsLayout() {
  const screenOptions = useStackScreenOptions({ fillContent: true });
  const { t } = useTranslation('achievement');

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: t('titles.index') }} />
      <Stack.Screen name="[year]/[week]" options={{ title: t('titles.detail') }} />
    </Stack>
  );
}

export default AchievementsLayout;
