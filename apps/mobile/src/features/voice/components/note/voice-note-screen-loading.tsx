import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useTranslation } from '@src/shared/i18n';
import { Result } from '@src/shared/ui';
import { router } from 'expo-router';
import { ActivityIndicator } from 'react-native';

/**
 * 말로 메모 화면 전체를 기다리는 동안 보인다. 캐시 없이 오프라인이면 조회가 연결될 때까지 멈추는데
 * 이 화면은 스와이프로 닫히지 않아서, 스피너만 두지 않고 닫을 길을 준다. 연결되면 조회가 이어져 화면이 열린다.
 */
export function VoiceNoteScreenLoading() {
  const { t } = useTranslation('voiceNote');
  const isOnline = useIsOnline();

  if (isOnline) {
    return <ActivityIndicator className="flex-1" />;
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
