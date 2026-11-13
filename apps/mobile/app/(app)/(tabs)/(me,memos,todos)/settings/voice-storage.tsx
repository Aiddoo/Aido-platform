import { VoiceStorageUsage } from '@src/features/voice/components/voice-storage-usage';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary } from '@src/shared/ui';
import { Stack } from 'expo-router';
import { Suspense } from 'react';

export default function VoiceStorageRoute() {
  const { t } = useTranslation('settings');

  return (
    <>
      <Stack.Screen options={{ title: t('titles.voiceStorage') }} />

      <QueryErrorBoundary fallback={VoiceStorageUsage.Error}>
        <Suspense fallback={<VoiceStorageUsage.Loading />}>
          <VoiceStorageUsage />
        </Suspense>
      </QueryErrorBoundary>
    </>
  );
}
