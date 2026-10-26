import { useTranslation } from '@src/shared/i18n';
import { useStackBackToolbar, useStackScreenOptions } from '@src/shared/ui';
import { Stack } from 'expo-router';

// 로그인 전에도 열리는 공개 초대 화면. 링크로 바로 열면 돌아갈 화면이 없어 첫 화면으로 보낸다
export default function InviteLayout() {
  const screenOptions = useStackScreenOptions({ background: 'bg-gray-1', fillContent: true });
  const backToolbar = useStackBackToolbar({ fallbackHref: '/' });
  const { t } = useTranslation('invite');

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: t('codeEntry.title') }}>
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen name="[inviteCode]" options={{ title: '' }}>
        {backToolbar}
      </Stack.Screen>
    </Stack>
  );
}
