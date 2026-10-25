import { useTranslation } from '@src/shared/i18n';
import {
  SHEET_ROUTE_SCREEN_OPTIONS,
  useStackBackToolbar,
  useStackScreenOptions,
} from '@src/shared/ui';
import { Stack } from 'expo-router';

function SuggestionsLayout() {
  const screenOptions = useStackScreenOptions();
  const backToolbar = useStackBackToolbar();
  const { t } = useTranslation('ai');

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: t('titles.suggestions') }}>
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen name="[suggestionId]/category" options={SHEET_ROUTE_SCREEN_OPTIONS} />
    </Stack>
  );
}

export default SuggestionsLayout;
