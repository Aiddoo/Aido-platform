import { useStackScreenOptions } from '@src/shared/ui';
import { Stack } from 'expo-router';

export default function VoiceNotesLayout() {
  const screenOptions = useStackScreenOptions({ background: 'bg-white', fillContent: true });

  return (
    <Stack screenOptions={{ ...screenOptions, headerShown: false }}>
      <Stack.Screen name="record" />
      <Stack.Screen name="[draftId]" />
    </Stack>
  );
}
