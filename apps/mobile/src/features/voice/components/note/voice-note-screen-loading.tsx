import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useTranslation } from '@src/shared/i18n';
import { Result, TextSkeleton, VStack } from '@src/shared/ui';
import { times } from 'es-toolkit/compat';
import { router } from 'expo-router';

import { VoiceNoteHeader } from './voice-note-header';

const LOADING_LINE_COUNT = 4;

/**
 * 말로 메모 화면 전체를 기다리는 동안 보인다. 이 화면은 스와이프로 닫히지 않아서 기다리는 동안에도 닫을 길을 둔다.
 * 캐시 없이 오프라인이면 조회가 연결될 때까지 멈추므로 이유를 알린다. 연결되면 조회가 이어져 화면이 열린다.
 */
export function VoiceNoteScreenLoading() {
  const { t } = useTranslation('voiceNote');
  const isOnline = useIsOnline();

  if (isOnline) {
    return (
      <VStack flex={1} gap={12} className="px-4 pb-3 pt-2" testID="voice-note-screen-loading">
        <VoiceNoteHeader onClose={() => router.back()} />
        <VStack gap={8}>
          {times(LOADING_LINE_COUNT, (index) => (
            <TextSkeleton key={index} size="b2" className="w-full" />
          ))}
        </VStack>
      </VStack>
    );
  }

  return (
    <Result
      testID="voice-note-screen-offline"
      className="px-4"
      title={t('offlineScreen.title')}
      description={t('offlineScreen.description')}
      button={<Result.Button onPress={() => router.back()}>{t('record.close')}</Result.Button>}
    />
  );
}
