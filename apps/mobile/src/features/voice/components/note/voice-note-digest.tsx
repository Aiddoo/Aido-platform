import { useTranslation } from '@src/shared/i18n';
import { Result, Text, VStack } from '@src/shared/ui';
import { Stack, router } from 'expo-router';

import { VoiceNotePolicy } from '../../domains/voice-note.model';
import { canRetryPlanFailure } from '../../domains/voice.error';
import { useCurrentVoiceNote } from '../../hooks/use-current-voice-note';
import { useVoiceNoteDigest, type VoiceNoteDigestFailure } from '../../hooks/use-voice-note-digest';
import { type VoiceNote } from '../../schemas/voice-note.schema';
import { DigestProgress } from './digest-progress';
import { DigestScanPreview } from './digest-scan-preview';
import { SentenceCaptionList } from './sentence-caption-list';
import { VoiceNoteDigestButton } from './voice-note-digest-button';
import { VoiceNoteToolbar } from './voice-note-toolbar';

const SCAN_PREVIEW_SENTENCES = 12;

interface VoiceNoteDigestProps {
  note: VoiceNote;
}

interface VoiceNoteDigestScreenProps extends VoiceNoteDigestProps {
  onMemoChanged: () => void;
}

export function VoiceNoteDigest({ note, onMemoChanged }: VoiceNoteDigestScreenProps) {
  const { t } = useTranslation('voiceNote');
  const { accountId, draftId } = useCurrentVoiceNote();
  const { digest, isPending, failure } = useVoiceNoteDigest({ accountId, draftId });

  if (isPending) {
    return <VoiceNoteDigest.Progress note={note} />;
  }

  return (
    <VStack flex={1} gap={12} className="px-4 pb-3 pt-2">
      <Stack.Screen options={{ title: t('digest.readyTitle') }} />
      <VoiceNoteToolbar note={note} onMemoChanged={onMemoChanged} />
      <SentenceCaptionList sentences={note.sentences} className="min-h-24 flex-1" />
      {failure != null && <VoiceNoteDigest.Failure failure={failure} />}
      {(failure == null || canRetryPlanFailure(failure.cause)) && (
        <VoiceNoteDigestButton
          label={failure == null ? t('digest.action') : t('digest.retry')}
          isDisabled={!VoiceNotePolicy.canDigest(note)}
          onPress={() => digest()}
        />
      )}
    </VStack>
  );
}

VoiceNoteDigest.Progress = function Progress({ note }: VoiceNoteDigestProps) {
  const { t } = useTranslation('voiceNote');

  return (
    <VStack flex={1} gap={16} className="px-4 pb-3 pt-2" testID="voice-note-digesting">
      <Stack.Screen options={{ title: t('digest.title') }} />
      <DigestScanPreview
        paragraphs={note.sentences.slice(0, SCAN_PREVIEW_SENTENCES).map(({ text }) => text)}
        className="max-h-[50%]"
      />
      <DigestProgress
        characterCount={VoiceNotePolicy.getCharacterCount(note)}
        markCount={VoiceNotePolicy.getMarkCount(note)}
      />
      <Text size="e1" shade={5} align="center" lineBreakStrategyIOS="hangul-word">
        {t('digest.hint')}
      </Text>
    </VStack>
  );
};

VoiceNoteDigest.Failure = function Failure({ failure }: { failure: VoiceNoteDigestFailure }) {
  const { t } = useTranslation(['voiceNote', 'voicePlan']);

  return (
    <VStack gap={4} className="rounded-2xl bg-gray-1 px-4 py-3" testID="voice-note-digest-failure">
      <Text size="b3" weight="semibold" lineBreakStrategyIOS="hangul-word">
        {t(`voicePlan:failure.${failure.cause}.title`)}
      </Text>
      <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
        {failure.cause === 'too-long' ? `${t('voiceNote:digest.tooLong')} ` : ''}
        {failure.cause === 'network' ? `${t('voiceNote:digest.offline')} ` : ''}
        {t('voiceNote:digest.kept')}
        {failure.isNotCharged ? ` ${t('voiceNote:digest.notCharged')}` : ''}
      </Text>
    </VStack>
  );
};

/**
 * 말로 메모 화면이 캐시 없이 오프라인이라 조회가 연결될 때까지 멈출 때 이유를 알린다.
 * 연결되면 조회가 이어져 화면이 열리고, 그동안 닫을 길이 된다.
 */
VoiceNoteDigest.Offline = function Offline() {
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
};
