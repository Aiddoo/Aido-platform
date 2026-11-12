import { VoiceStorageUsage } from '@src/features/voice/components/voice-storage-usage';
import { QueryErrorBoundary } from '@src/shared/ui';
import { Suspense } from 'react';

export default function VoiceStorageRoute() {
  return (
    <QueryErrorBoundary fallback={VoiceStorageUsage.Error}>
      <Suspense fallback={<VoiceStorageUsage.Loading />}>
        <VoiceStorageUsage />
      </Suspense>
    </QueryErrorBoundary>
  );
}
