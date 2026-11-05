import { useTranslation } from '@src/shared/i18n';
import { STACK_CLOSE_ICON, useStackBackToolbar, useStackScreenOptions } from '@src/shared/ui';
import { Stack } from 'expo-router';

export default function VoiceNotesLayout() {
  const { t } = useTranslation('voiceNote');
  const screenOptions = useStackScreenOptions({ background: 'bg-white', fillContent: true });
  const backToolbar = useStackBackToolbar({ fallbackHref: '/memo' });
  // 화면이 뜨기 전에도 닫을 수 있게 레이아웃이 먼저 둔다. 녹음이 시작되면 화면의 툴바가 묻고 닫는 동작으로 덮는다
  const closeToolbar = useStackBackToolbar({
    fallbackHref: '/memo',
    icon: STACK_CLOSE_ICON,
    accessibilityLabel: t('record.close'),
  });

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: t('drafts.title') }}>
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen name="record" options={{ title: t('record.title') }}>
        {closeToolbar}
      </Stack.Screen>
      <Stack.Screen name="[draftId]" options={{ title: '' }}>
        {backToolbar}
      </Stack.Screen>
    </Stack>
  );
}
