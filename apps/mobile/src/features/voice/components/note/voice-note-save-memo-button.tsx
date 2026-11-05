import { useIdGenerator, useVoiceNoteStorageService } from '@src/bootstrap/providers/di-context';
import { useTranslation } from '@src/shared/i18n';
import { Button, CheckmarkIcon, HStack, MemoIcon, Text } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { Spinner } from 'heroui-native';

import { type VoiceNote, VoiceNotePolicy } from '../../domains/voice-note.model';
import { isPlanKeyConflictError } from '../../domains/voice.error';
import { useCurrentVoiceNote } from '../../hooks/use-current-voice-note';
import { useApplyActionPlanMutationOptions } from '../../queries/use-apply-action-plan-mutation-options';

/** 메모만 저장할 때 넘기는 값. 메모는 카테고리를 쓰지 않아 저장 요청에 실리지 않는다 */
const UNUSED_CATEGORY_ID = 0;

const PILL_ICON_SIZE = 16;
/** 32 높이의 머리글 버튼을 44로 넓힌다 */
const PILL_HIT_SLOP = 6;

interface VoiceNoteSaveMemoButtonProps {
  note: VoiceNote;
}

/** 정리한 내용을 메모 한 장으로 저장한다. 저장했으면 다시 저장하지 않게 같은 자리에 저장했다고만 보인다 */
export function VoiceNoteSaveMemoButton({ note }: VoiceNoteSaveMemoButtonProps) {
  const { t } = useTranslation('voiceNote');
  const { accountId, draftId } = useCurrentVoiceNote();
  const { drafts } = useVoiceNoteStorageService();
  const idGenerator = useIdGenerator();
  const mutation = useMutation(
    useApplyActionPlanMutationOptions({
      onSaved: () => {
        const latest = drafts.find(accountId, draftId);
        if (latest != null) {
          drafts.save(accountId, VoiceNotePolicy.withMemoSavedAt(latest, new Date()));
        }
      },
    }),
  );
  const memo = VoiceNotePolicy.createDigestMemo(note);

  if (note.memoSavedAt != null) {
    return <VoiceNoteSaveMemoButton.Saved />;
  }
  if (memo == null) {
    return null;
  }

  const saveMemoRequest = (idempotencyKey: string | null) => {
    const latest = drafts.find(accountId, draftId);
    if (latest != null) {
      drafts.save(
        accountId,
        VoiceNotePolicy.withMemoSaveRequest(
          latest,
          idempotencyKey == null ? null : { idempotencyKey },
        ),
      );
    }
  };

  const handleSave = () => {
    // 응답을 놓친 뒤 다시 눌러도 같은 키라 메모가 두 장이 되지 않는다
    const idempotencyKey = note.memoSaveRequest?.idempotencyKey ?? idGenerator.create();
    saveMemoRequest(idempotencyKey);
    mutation.mutate(
      {
        source: 'voice-note',
        sourceMemoId: null,
        actions: [memo],
        fallbackCategoryId: UNUSED_CATEGORY_ID,
        skippedCount: 0,
        idempotencyKey,
      },
      {
        onError: (error) => {
          if (isPlanKeyConflictError(error)) {
            saveMemoRequest(null);
          }
        },
      },
    );
  };

  return (
    <Button
      size="small"
      variant="weak"
      display="inline"
      radius="full"
      hitSlop={PILL_HIT_SLOP}
      accessibilityLabel={t('result.saveMemo')}
      isDisabled={mutation.isPending}
      onPress={handleSave}
      className="shrink"
      testID="voice-note-save-memo"
    >
      <HStack gap={4} align="center" className="shrink">
        {/* isLoading은 글자를 스피너로 바꿔 폭이 줄어든다. 글자를 두고 아이콘 자리만 바꾼다 */}
        {mutation.isPending ? (
          <Spinner size="sm" color="default" />
        ) : (
          <MemoIcon width={PILL_ICON_SIZE} height={PILL_ICON_SIZE} colorClassName="text-main" />
        )}
        <Text size="b4" weight="semibold" tone="brand" maxLines={1} className="shrink">
          {t('result.saveMemo')}
        </Text>
      </HStack>
    </Button>
  );
}

VoiceNoteSaveMemoButton.Saved = function Saved() {
  const { t } = useTranslation('voiceNote');

  return (
    <HStack
      gap={4}
      align="center"
      className="h-8 shrink rounded-full bg-gray-9/5 px-3 dark:bg-gray-9/20"
      testID="voice-note-memo-saved"
    >
      <CheckmarkIcon width={PILL_ICON_SIZE} height={PILL_ICON_SIZE} colorClassName="text-gray-7" />
      <Text size="b4" weight="medium" shade={7} maxLines={1} className="shrink">
        {t('result.memoSaved')}
      </Text>
    </HStack>
  );
};
