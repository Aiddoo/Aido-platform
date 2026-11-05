import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useTranslation } from '@src/shared/i18n';
import { Result, TextSkeleton, VStack } from '@src/shared/ui';
import { times } from 'es-toolkit/compat';
import { router } from 'expo-router';

const LOADING_LINE_COUNT = 4;

/**
 * 말로 메모 화면 전체를 기다리는 동안 보인다. 헤더는 레이아웃이 미리 그려 받은 뒤에 밀리지 않고,
 * 스와이프로 닫히지 않는 이 화면에서 기다리는 동안에도 닫을 길이 된다.
 * 캐시 없이 오프라인이면 조회가 연결될 때까지 멈추므로 이유를 알린다. 연결되면 조회가 이어져 화면이 열린다.
 */
export function VoiceNoteScreenLoading() {
  const { t } = useTranslation('voiceNote');
  const isOnline = useIsOnline();

  if (isOnline) {
    return (
      <VStack gap={8} className="px-4 pb-3 pt-2" testID="voice-note-screen-loading">
        {times(LOADING_LINE_COUNT, (index) => (
          <TextSkeleton key={index} size="b2" className="w-full" />
        ))}
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
