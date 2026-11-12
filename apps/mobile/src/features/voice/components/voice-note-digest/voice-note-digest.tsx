import { useQuotaStatus } from '@src/features/billing/subscription/hooks/use-quota-status';
import { useSuspenseMyAccountId } from '@src/features/identity/user/hooks/use-suspense-my-account-id';
import { useTranslation } from '@src/shared/i18n';
import {
  AiFilledIcon,
  Button,
  HStack,
  SurfaceCard,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { Stack } from 'expo-router';
import type { ComponentProps } from 'react';
import { match } from 'ts-pattern';

import { VoiceNotePolicy } from '../../domains/voice-note.model';
import { canRetryPlanFailure } from '../../domains/voice.error';
import { useCurrentVoiceNote } from '../../hooks/use-current-voice-note';
import { useVoiceNoteDigest, type VoiceNoteDigestFailure } from '../../hooks/use-voice-note-digest';
import { useVoiceNoteDraftId } from '../../hooks/use-voice-note-params';
import { SentenceCaptionList } from '../sentence-caption-list';
import { VoiceNoteToolbar } from '../voice-note-toolbar';
import { DigestProgress } from './digest-progress';
import { DigestScanPreview } from './digest-scan-preview';

const SCAN_PREVIEW_SENTENCES = 12;

interface VoiceNoteDigestProps {
  onMemoChanged: () => void;
}

export function VoiceNoteDigest({ onMemoChanged }: VoiceNoteDigestProps) {
  const { t } = useTranslation('voiceNote');
  const accountId = useSuspenseMyAccountId();
  const [draftId] = useVoiceNoteDraftId();
  const note = useCurrentVoiceNote(accountId);
  const { digest, isPending, failure } = useVoiceNoteDigest({ accountId, draftId });

  if (isPending) {
    return <VoiceNoteDigest.Progress />;
  }

  return (
    <VStack flex={1} gap={12} className="pb-3">
      <Stack.Screen options={{ title: t('digest.readyTitle') }} />
      <VoiceNoteToolbar onMemoChanged={onMemoChanged} />
      <SentenceCaptionList sentences={note.sentences} className="min-h-24 flex-1" />
      {failure != null && <VoiceNoteDigest.Failure failure={failure} />}
      {(failure == null || canRetryPlanFailure(failure.cause)) && (
        <DigestButton
          label={failure == null ? t('digest.action') : t('digest.retry')}
          isDisabled={!VoiceNotePolicy.canDigest(note)}
          onPress={() => digest()}
        />
      )}
    </VStack>
  );
}

VoiceNoteDigest.Progress = function Progress() {
  const { t } = useTranslation('voiceNote');
  const accountId = useSuspenseMyAccountId();
  const note = useCurrentVoiceNote(accountId);

  return (
    <VStack flex={1} gap={16} className="pb-3" testID="voice-note-digesting">
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
    <SurfaceCard className="gap-1 px-4 py-3" testID="voice-note-digest-failure">
      <Text size="b3" weight="semibold" lineBreakStrategyIOS="hangul-word">
        {t(`voicePlan:failure.${failure.cause}.title`)}
      </Text>
      <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
        {failure.cause === 'too-long' ? `${t('voiceNote:digest.tooLong')} ` : ''}
        {failure.cause === 'network' ? `${t('voiceNote:digest.offline')} ` : ''}
        {t('voiceNote:digest.kept')}
        {failure.isFreeOfCharge ? ` ${t('voiceNote:digest.notCharged')}` : ''}
      </Text>
    </SurfaceCard>
  );
};

interface DigestButtonProps extends Omit<ComponentProps<typeof Button>, 'children'> {
  label: string;
}

/** 확인 창 없이 횟수를 쓰므로 보조 문구로 알린다. 프리미엄·관리자는 숨기고, 읽는 동안 자리를 잡아 밀리지 않게 한다 */
function DigestButton({ label, ...buttonProps }: DigestButtonProps) {
  const { t } = useTranslation('voiceNote');
  const { status, isPending } = useQuotaStatus('VOICE_NOTE');
  const cost = match(status)
    .with({ type: 'untracked' }, () => null)
    .with({ type: 'remaining' }, ({ count }) => t('digest.cost', { amount: count }))
    .with({ type: 'used-up' }, () => t('digest.usedUp'))
    .exhaustive();

  return (
    <VStack gap={8}>
      <Button {...buttonProps} testID="voice-note-digest">
        {label}
      </Button>
      {cost == null && isPending && <TextSkeleton size="e1" className="mx-auto w-32" />}
      {cost != null && (
        <HStack gap={4} align="center" justify="center">
          <AiFilledIcon width={14} height={14} colorClassName="text-main" />
          <Text size="e1" shade={6} numberOfLines={1} testID="voice-note-digest-cost">
            {cost}
          </Text>
        </HStack>
      )}
    </VStack>
  );
}
