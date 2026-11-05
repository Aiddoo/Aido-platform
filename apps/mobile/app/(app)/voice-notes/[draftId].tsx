import { zodResolver } from '@hookform/resolvers/zod';
import { useVoiceNoteStorageService } from '@src/bootstrap/providers/di-context';
import { useGetPreferenceQueryOptions } from '@src/features/preference/queries/get-preference-query-options';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/queries/get-todo-categories-query-options';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { DigestProgress } from '@src/features/voice/components/note/digest-progress';
import { DigestScanPreview } from '@src/features/voice/components/note/digest-scan-preview';
import { KeyPointList } from '@src/features/voice/components/note/key-point-list';
import { SentenceCaptionList } from '@src/features/voice/components/note/sentence-caption-list';
import { VoiceNoteDigestButton } from '@src/features/voice/components/note/voice-note-digest-button';
import { VoiceNoteHeader } from '@src/features/voice/components/note/voice-note-header';
import { VoiceNotePlayerBar } from '@src/features/voice/components/note/voice-note-player-bar';
import { VoiceNoteScreenLoading } from '@src/features/voice/components/note/voice-note-screen-loading';
import { PlanReview } from '@src/features/voice/components/plan/plan-review';
import {
  type PlanReviewFormValues,
  planReviewFormSchema,
  toVoicePlanFromDraft,
} from '@src/features/voice/domains/plan-review-form.schema';
import { type VoiceNote, VoiceNotePolicy } from '@src/features/voice/domains/voice-note.model';
import { voicePlanIdSchema } from '@src/features/voice/domains/voice-plan.model';
import {
  canRetryPlanFailure,
  isPlanKeyConflictError,
} from '@src/features/voice/domains/voice.error';
import {
  useVoiceNoteDigest,
  type VoiceNoteDigestFailure,
} from '@src/features/voice/hooks/use-voice-note-digest';
import {
  useVoiceNoteParams,
  useVoiceNoteTab,
  voiceNoteParamsSchema,
  voiceNoteTabSchema,
} from '@src/features/voice/hooks/use-voice-note-params';
import {
  useVoiceNotePlayback,
  useVoiceNotePlayer,
  type VoiceNotePlayer,
} from '@src/features/voice/hooks/use-voice-note-player';
import { useVoiceNote } from '@src/features/voice/hooks/use-voice-notes';
import { useApplyActionPlanMutationOptions } from '@src/features/voice/queries/use-apply-action-plan-mutation-options';
import { getDurationBucket } from '@src/features/voice/utils/analytics/duration-bucket';
import { formatMediaTime } from '@src/features/voice/utils/format-media-time';
import {
  createSpeechLevels,
  getFlagBarIndexes,
} from '@src/features/voice/utils/view-models/waveform.view-model';
import { useTrack } from '@src/shared/analytics';
import { useFormDraftAutosave } from '@src/shared/draft/use-form-draft-autosave';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  HStack,
  QueryErrorBoundary,
  Result,
  StyledSafeAreaView,
  Text,
  TextButton,
  useConfirmDialog,
  VStack,
} from '@src/shared/ui';
import { formatDateLabel } from '@src/shared/utils/date-format';
import { useMutation, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { randomUUID } from 'expo-crypto';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Tabs } from 'heroui-native';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { match } from 'ts-pattern';

/** 정리 중 미리보기에 보여 줄 앞부분 문장 수. 전체를 그릴 이유가 없다 */
const SCAN_PREVIEW_SENTENCES = 12;

/** 메모만 저장할 때 넘기는 값. 메모는 카테고리를 쓰지 않아 저장 요청에 실리지 않는다 */
const UNUSED_CATEGORY_ID = 0;

const closeScreen = () => {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/memo');
  }
};

function useCurrentVoiceNote() {
  const { draftId } = useVoiceNoteParams();
  const { data: me } = useSuspenseQuery(useGetMeQueryOptions());
  return { accountId: me.id, draftId, note: useVoiceNote(me.id, draftId) };
}

function VoiceNoteScreen() {
  const { t } = useTranslation('voiceNote');
  const { note } = useCurrentVoiceNote();

  if (note == null) {
    return (
      <VStack flex={1} className="px-4 pt-2">
        <VoiceNoteHeader onClose={closeScreen} />
        <Result title={t('result.notFound')} testID="voice-note-not-found" />
      </VStack>
    );
  }

  return note.digest == null ? <VoiceNoteDigest note={note} /> : <VoiceNoteResult note={note} />;
}

interface VoiceNoteDigestProps {
  note: VoiceNote;
}

/** 정리 전: 들은 글자를 보여 주고, 누르면 정리한다. 실패해도 글자는 그대로 있고 다시 정리할 수 있다 */
function VoiceNoteDigest({ note }: VoiceNoteDigestProps) {
  const { t } = useTranslation('voiceNote');
  const { accountId, draftId } = useCurrentVoiceNote();
  const { digest, isPending, failure } = useVoiceNoteDigest({ accountId, draftId });

  if (isPending) {
    return <VoiceNoteDigest.Progress note={note} />;
  }

  return (
    <VStack flex={1} gap={12} className="px-4 pb-3 pt-2">
      <VoiceNoteHeader title={t('digest.readyTitle')} onClose={closeScreen} />
      <SentenceCaptionList sentences={note.sentences} className="min-h-24 flex-1" />
      {failure != null && <VoiceNoteDigest.Failure failure={failure} />}
      {(failure == null || canRetryPlanFailure(failure.cause)) && (
        <VoiceNoteDigestButton
          label={failure == null ? t('digest.action') : t('digest.retry')}
          isDisabled={!VoiceNotePolicy.canDigest(note)}
          onPress={() => digest()}
        />
      )}
      <DeleteVoiceNoteButton />
    </VStack>
  );
}

VoiceNoteDigest.Progress = function Progress({ note }: VoiceNoteDigestProps) {
  const { t } = useTranslation('voiceNote');

  return (
    <VStack flex={1} gap={16} className="px-4 pb-3 pt-2" testID="voice-note-digesting">
      <VoiceNoteHeader title={t('digest.title')} onClose={closeScreen} />
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

/** 정리 뒤: 제목·재생 줄 아래로 요약·할 일·전문을 고른다. 넓은 화면은 할 일 칸이 옆에 늘 보인다 */
function VoiceNoteResult({ note }: { note: VoiceNote }) {
  const { t } = useTranslation('voiceNote');
  const { accountId } = useCurrentVoiceNote();
  const [tab, setTab] = useVoiceNoteTab();
  const { recordings } = useVoiceNoteStorageService();
  const isCompact = useWindowSizeClass() === 'compact';
  const dateFormatContext = useDateFormatContext();
  const [parts] = useState(() =>
    note.recordings.flatMap(({ fileName, startMs }) => {
      const uri = recordings.findUri(accountId, fileName);
      return uri == null ? [] : [{ uri, startMs }];
    }),
  );
  const player = useVoiceNotePlayer({ parts, durationMs: note.durationMs });
  // 결과 화면에서는 문장이 바뀌지 않아 한 번만 만든다. 자동 저장으로 노트가 바뀔 때마다 다시 계산하지 않는다
  const [levels] = useState(() => createSpeechLevels(note.sentences, note.durationMs));
  const markCount = VoiceNotePolicy.getMarkCount(note);
  const date = formatDateLabel(note.createdAt, 'monthDay', dateFormatContext);
  const duration = formatMediaTime(note.durationMs);
  const canPlay = parts.length > 0;
  const todos = (
    <QueryErrorBoundary>
      <Suspense fallback={<PlanReview.Loading />}>
        <VoiceNoteResult.Todos note={note} />
      </Suspense>
    </QueryErrorBoundary>
  );
  const selectedTab = !isCompact && tab === 'todos' ? 'summary' : tab;

  return (
    <VStack flex={1} gap={12} className="px-4 pt-2">
      <VoiceNoteHeader onClose={closeScreen} right={<VoiceNoteResult.SaveMemo note={note} />} />
      <VStack gap={4}>
        <Text size="t3" weight="bold" lineBreakStrategyIOS="hangul-word">
          {VoiceNotePolicy.getDigestTitle(note) ?? t('result.defaultTitle')}
        </Text>
        <Text size="e1" shade={6} className="tabular-nums">
          {markCount > 0
            ? t('result.metaMarks', { date, duration, amount: markCount })
            : t('result.meta', { date, duration })}
        </Text>
      </VStack>
      <VoiceNotePlayerBar
        player={player}
        levels={levels}
        flagIndexes={getFlagBarIndexes(note.sentences)}
        isRecordingAvailable={canPlay}
      />
      <HStack flex={1} gap={20}>
        <VStack flex={1} gap={12}>
          <Tabs
            value={selectedTab}
            onValueChange={(next) => {
              const parsed = voiceNoteTabSchema.safeParse(next);
              if (parsed.success) {
                setTab(parsed.data);
              }
            }}
          >
            <Tabs.List>
              <Tabs.Indicator />
              <Tabs.Trigger value="summary" testID="voice-note-tab-summary">
                <Tabs.Label numberOfLines={1}>{t('result.tabs.summary')}</Tabs.Label>
              </Tabs.Trigger>
              {isCompact && (
                <Tabs.Trigger value="todos" testID="voice-note-tab-todos">
                  <Tabs.Label numberOfLines={1}>
                    {t('result.tabs.todos', { amount: VoiceNotePolicy.getPlannedTodoCount(note) })}
                  </Tabs.Label>
                </Tabs.Trigger>
              )}
              <Tabs.Trigger value="transcript" testID="voice-note-tab-transcript">
                <Tabs.Label numberOfLines={1}>{t('result.tabs.transcript')}</Tabs.Label>
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs>
          <Animated.View entering={FadeIn.duration(200)} key={selectedTab} style={{ flex: 1 }}>
            {match(selectedTab)
              .with('summary', () => (
                <VoiceNoteResult.Summary note={note} player={player} canPlay={canPlay} />
              ))
              .with('todos', () => todos)
              .with('transcript', () => (
                <VoiceNoteResult.Transcript note={note} player={player} canPlay={canPlay} />
              ))
              .exhaustive()}
          </Animated.View>
        </VStack>
        {!isCompact && <Box flex={1}>{todos}</Box>}
      </HStack>
    </VStack>
  );
}

interface VoiceNoteResultPlaybackProps {
  note: VoiceNote;
  player: VoiceNotePlayer;
  /** 들을 녹음 파일이 기기에 있다 */
  canPlay: boolean;
}

VoiceNoteResult.Summary = function Summary({
  note,
  player,
  canPlay,
}: VoiceNoteResultPlaybackProps) {
  const { t } = useTranslation('voiceNote');
  const isCompact = useWindowSizeClass() === 'compact';

  return (
    <ScrollView contentContainerClassName="gap-4 pb-6" showsVerticalScrollIndicator={false}>
      <Text size="b2" lineBreakStrategyIOS="hangul-word">
        {note.digest?.summary}
      </Text>
      {/* 넓은 화면은 할 일 칸이 늘 보여 거기서 알린다 */}
      {isCompact && VoiceNotePolicy.hasNoPlannedTodos(note) && (
        <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word" testID="voice-note-no-todos">
          {t('result.noTodos')}
        </Text>
      )}
      <VStack gap={4}>
        <Text size="b4" weight="semibold" shade={6}>
          {t('keyPoints.title')}
        </Text>
        <VoiceNoteResult.KeyPoints note={note} player={player} canPlay={canPlay} />
      </VStack>
      <DeleteVoiceNoteButton />
    </ScrollView>
  );
};

/** 재생 중인 포인트가 바뀔 때만 다시 그린다 */
VoiceNoteResult.KeyPoints = function KeyPoints({
  note,
  player,
  canPlay,
}: VoiceNoteResultPlaybackProps) {
  const { trackEvent } = useTrack();
  const activeKeyPointId = useVoiceNotePlayback(player, ({ isPlaying, positionMs }) =>
    isPlaying ? VoiceNotePolicy.findKeyPointAt(note, positionMs)?.id : undefined,
  );

  return (
    <KeyPointList
      hasTimeCoachmark
      keyPoints={note.digest?.keyPoints ?? []}
      activeKeyPointId={activeKeyPointId}
      onPressKeyPoint={
        canPlay
          ? ({ startMs }) => {
              if (startMs == null) {
                return;
              }
              trackEvent('voice_note_key_point_played', {
                position_bucket: getDurationBucket(startMs),
              });
              player.playFrom(startMs).catch(noop);
            }
          : undefined
      }
    />
  );
};

/** 재생 중인 문장이 바뀔 때만 다시 그린다 */
VoiceNoteResult.Transcript = function Transcript({
  note,
  player,
  canPlay,
}: VoiceNoteResultPlaybackProps) {
  const activeSentenceIndex = useVoiceNotePlayback(player, ({ isPlaying, positionMs }) =>
    isPlaying ? VoiceNotePolicy.findSentenceIndexAt(note, positionMs) : undefined,
  );

  return (
    <SentenceCaptionList
      sentences={note.sentences}
      activeSentenceIndex={activeSentenceIndex}
      onPressSentence={canPlay ? ({ startMs }) => player.playFrom(startMs).catch(noop) : undefined}
      className="min-h-24 flex-1"
    />
  );
};

/** 할 일 칸. 고친 카드는 초안에 함께 남아 앱을 다시 켜도 그대로다 */
VoiceNoteResult.Todos = function Todos({ note }: { note: VoiceNote }) {
  const { t } = useTranslation('voiceNote');
  const { accountId, draftId } = useCurrentVoiceNote();
  const { drafts } = useVoiceNoteStorageService();
  const [{ data: categoriesResult }] = useSuspenseQueries({
    queries: [useGetTodoCategoriesQueryOptions(), useGetPreferenceQueryOptions()],
  });
  const fallbackCategoryId = categoriesResult.categories[0]?.id;
  const form = useForm<PlanReviewFormValues>({
    resolver: zodResolver(planReviewFormSchema),
    defaultValues: note.planDraft?.form ?? { actions: [] },
    mode: 'onChange',
  });

  useFormDraftAutosave(form.subscribe, {
    initialValues: { actions: [] },
    saveDraft: (values) => {
      const latest = drafts.find(accountId, draftId);
      if (latest?.planDraft != null) {
        drafts.save(
          accountId,
          VoiceNotePolicy.withPlanDraft(latest, {
            omittedTodoCount: latest.planDraft.omittedTodoCount,
            form: values,
          }),
        );
      }
    },
    clearDraft: noop,
  });

  return match(VoiceNotePolicy.getPlanStatus(note))
    .with({ status: 'applied' }, () => (
      <Result title={t('result.applied')} testID="voice-note-applied" />
    ))
    .with({ status: 'no-todos' }, () => (
      <Result title={t('result.noTodos')} testID="voice-note-no-todos" />
    ))
    .with({ status: 'lost' }, () => (
      <Result title={t('result.planLost')} testID="voice-note-plan-lost" />
    ))
    .with({ status: 'reviewable' }, ({ planDraft }) =>
      fallbackCategoryId == null ? (
        <Result title={t('result.noTodos')} />
      ) : (
        <ScrollView contentContainerClassName="pb-6" showsVerticalScrollIndicator={false}>
          <PlanReview
            form={form}
            plan={toVoicePlanFromDraft(
              {
                planId: voicePlanIdSchema.parse(draftId),
                source: 'voice-note',
                sourceMemoId: null,
              },
              planDraft,
            )}
            fallbackCategoryId={fallbackCategoryId}
            requestStore={{
              find: () => drafts.find(accountId, draftId)?.planApplyRequest ?? null,
              save: (request) => {
                const latest = drafts.find(accountId, draftId);
                if (latest != null) {
                  drafts.save(accountId, VoiceNotePolicy.withPlanApplyRequest(latest, request));
                }
              },
            }}
            onSaved={() => {
              const latest = drafts.find(accountId, draftId);
              if (latest != null) {
                drafts.save(accountId, VoiceNotePolicy.withAppliedAt(latest, new Date()));
              }
            }}
          />
        </ScrollView>
      ),
    )
    .exhaustive();
};

/** 정리한 내용을 메모 한 장으로 저장한다. 저장했으면 다시 저장하지 않게 글자로만 보인다 */
VoiceNoteResult.SaveMemo = function SaveMemo({ note }: { note: VoiceNote }) {
  const { t } = useTranslation('voiceNote');
  const { accountId, draftId } = useCurrentVoiceNote();
  const { drafts } = useVoiceNoteStorageService();
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
    return (
      <Text size="b4" shade={6} maxLines={1} testID="voice-note-memo-saved">
        {t('result.memoSaved')}
      </Text>
    );
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
    const idempotencyKey = note.memoSaveRequest?.idempotencyKey ?? randomUUID();
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
    <TextButton
      size="medium"
      isDisabled={mutation.isPending}
      onPress={handleSave}
      testID="voice-note-save-memo"
    >
      {t('result.saveMemo')}
    </TextButton>
  );
};

function DeleteVoiceNoteButton() {
  const { t } = useTranslation('voiceNote');
  const { accountId, draftId } = useCurrentVoiceNote();
  const storage = useVoiceNoteStorageService();
  const confirmDialog = useConfirmDialog();

  const handleDelete = async () => {
    const isConfirmed = await confirmDialog.open({
      title: t('result.deleteTitle'),
      description: t('result.deleteDescription'),
      confirmLabel: t('result.deleteConfirm'),
      confirmColor: 'danger',
      cancelLabel: t('result.deleteCancel'),
    });
    if (isConfirmed) {
      storage.discard(accountId, draftId);
      closeScreen();
    }
  };

  return (
    <TextButton
      size="small"
      className="self-center"
      onPress={handleDelete}
      testID="voice-note-delete"
    >
      {t('result.delete')}
    </TextButton>
  );
}

export default function VoiceNoteRoute() {
  const params = voiceNoteParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/memo" />;
  }

  return (
    <StyledSafeAreaView className="flex-1 bg-white">
      <QueryErrorBoundary resetKeys={[params.data.draftId]}>
        <Suspense fallback={<VoiceNoteScreenLoading />}>
          <VoiceNoteScreen key={params.data.draftId} />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
