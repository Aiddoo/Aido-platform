import { useTranslation } from '@src/shared/i18n';
import { useStackBackToolbar, useStackScreenOptions } from '@src/shared/ui';
import { Stack } from 'expo-router';

export default function VoiceNotesLayout() {
  const { t } = useTranslation('voiceNote');
  const screenOptions = useStackScreenOptions({ background: 'bg-white', fillContent: true });
  const backToolbar = useStackBackToolbar({ fallbackHref: '/memo' });

  return (
    <Stack screenOptions={{ ...screenOptions, headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: true, title: t('drafts.title') }}>
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen name="record" />
      <Stack.Screen name="[draftId]" />
    </Stack>
  );
}
