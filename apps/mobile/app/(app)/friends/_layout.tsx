import { useTranslation } from '@src/shared/i18n';
import { useStackBackToolbar, useStackScreenOptions } from '@src/shared/ui';
import { Stack } from 'expo-router';

export default function FriendsLayout() {
  const screenOptions = useStackScreenOptions({ background: 'bg-white', fillContent: true });
  const backToolbar = useStackBackToolbar();
  const { t } = useTranslation('friend');
  const { t: tInvite } = useTranslation('invite');

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: t('screenTitle') }}>
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen name="search" options={{ title: t('search.title') }}>
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen name="add" options={{ title: '' }}>
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen name="invite/index" options={{ title: tInvite('myInvite.title') }}>
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen name="invite/invitees" options={{ title: tInvite('friendList.title') }}>
        {backToolbar}
      </Stack.Screen>
    </Stack>
  );
}
