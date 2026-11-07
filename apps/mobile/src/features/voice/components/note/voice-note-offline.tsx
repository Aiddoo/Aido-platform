import { useTranslation } from '@src/shared/i18n';
import { Result } from '@src/shared/ui';
import { router } from 'expo-router';

/**
 * 말로 메모 화면이 캐시 없이 오프라인이라 조회가 연결될 때까지 멈출 때 이유를 알린다.
 * 연결되면 조회가 이어져 화면이 열리고, 그동안 닫을 길이 된다.
 */
export function VoiceNoteOffline() {
  const { t } = useTranslation('voiceNote');

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
