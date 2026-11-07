import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { VoiceNoteRecordCaptions } from '@src/features/voice/components/note/voice-note-record-captions';
import { VoiceNoteRecordClock } from '@src/features/voice/components/note/voice-note-record-clock';
import { VoiceNoteRecordFooter } from '@src/features/voice/components/note/voice-note-record-footer';
import { VoiceNoteRecordLanguageToggle } from '@src/features/voice/components/note/voice-note-record-language-toggle';
import { VoiceNoteScreenLoading } from '@src/features/voice/components/note/voice-note-screen-loading';
import { RecognizerWaveform } from '@src/features/voice/components/note/waveform-timeline';
import { useRecognitionLanguage } from '@src/features/voice/hooks/use-recognition-language';
import { useSpeechContext } from '@src/features/voice/hooks/use-speech-context';
import { useVoiceNoteRecordParams } from '@src/features/voice/hooks/use-voice-note-params';
import { useVoiceNoteRecordExit } from '@src/features/voice/hooks/use-voice-note-record-exit';
import { useVoiceNoteRecordLimit } from '@src/features/voice/hooks/use-voice-note-record-limit';
import { useVoiceNoteRecording } from '@src/features/voice/hooks/use-voice-note-recording';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useOnScreenBlur } from '@src/shared/hooks/use-on-screen-blur';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useTranslation } from '@src/shared/i18n';
import { useKeepScreenAwake } from '@src/shared/infra/keep-awake/use-keep-screen-awake';
import {
  HStack,
  QueryErrorBoundary,
  STACK_CLOSE_ICON,
  StyledSafeAreaView,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { Suspense, useEffect, useLayoutEffect, useRef } from 'react';

function VoiceNoteRecordScreen() {
  const { t } = useTranslation('voiceNote');
  useKeepScreenAwake();
  const isCompact = useWindowSizeClass() === 'compact';
  const toast = useAppToast();
  const { data: me } = useSuspenseQuery(useGetMeQueryOptions());
  const { maxSeconds, limitMs, notifyLimit } = useVoiceNoteRecordLimit();
  const getSpeechContext = useSpeechContext();
  const [locale] = useRecognitionLanguage();
  const { draftId: seedDraftId, entry } = useVoiceNoteRecordParams();

  const recording = useVoiceNoteRecording({
    accountId: me.id,
    locale,
    seedDraftId,
    entry,
    maxSeconds,
    onLimitReached: () => notifyLimit(recording),
    onFinished: (draftId) =>
      router.replace({ pathname: '/voice-notes/[draftId]', params: { draftId } }),
    onEmpty: () => {
      toast.warning(t('record.empty'));
      router.back();
    },
  });
  useOnScreenBlur(recording.interrupt);
  const { requestClose, requestFinish } = useVoiceNoteRecordExit(recording);
  // 글자를 받을 때마다 recording이 새로 만들어진다. 헤더 옵션이 그때마다 바뀌면 내비게이터까지 다시 그려져 정체성을 고정한다
  const close = useSingleTap(requestClose);
  const changeLocaleRef = useRef(recording.changeLocale);
  useLayoutEffect(() => {
    changeLocaleRef.current = recording.changeLocale;
  });
  const { state } = recording;

  useEffect(() => {
    recording.start({ startLocale: locale, contextualStrings: getSpeechContext() }).catch(() => {
      toast.error(t('record.failedTitle'));
    });
  }, []);

  const clock = <VoiceNoteRecordClock state={state} limitMs={limitMs} />;
  const waveform = (
    <RecognizerWaveform
      level={recording.level}
      isActive={state.status === 'listening'}
      bookmarksMs={recording.bookmarksMs}
      className="self-stretch"
    />
  );
  const captions = (
    <VoiceNoteRecordCaptions sentences={recording.sentences} interimText={recording.interimText} />
  );
  const footer = (
    <VoiceNoteRecordFooter
      state={state}
      limitMs={limitMs}
      markCount={recording.markCount}
      onPause={recording.pause}
      onFinish={requestFinish}
      onMark={recording.mark}
      onSummarize={recording.finish}
      onClose={requestClose}
      onResume={recording.resume}
    />
  );

  return (
    <VStack flex={1} gap={12} className="px-4 pb-3 pt-2">
      <Stack.Screen
        options={{
          headerTitle: () => (
            <VoiceNoteRecordLanguageToggle
              onLocaleChange={(next) => changeLocaleRef.current(next)}
            />
          ),
        }}
      />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon={STACK_CLOSE_ICON}
          accessibilityLabel={t('record.close')}
          onPress={close}
        />
      </Stack.Toolbar>
      {isCompact ? (
        <>
          <VStack align="center" className={cn(state.status === 'paused' && 'opacity-60')}>
            {clock}
          </VStack>
          {waveform}
          {captions}
          {footer}
        </>
      ) : (
        <HStack flex={1} gap={20}>
          <VStack flex={1} gap={12} justify="center" align="center">
            {clock}
            {waveform}
            {footer}
          </VStack>
          <VStack flex={1}>{captions}</VStack>
        </HStack>
      )}
    </VStack>
  );
}

export default function VoiceNoteRecordRoute() {
  return (
    <StyledSafeAreaView edges={['left', 'right', 'bottom']} className="flex-1 bg-white">
      <QueryErrorBoundary>
        <Suspense fallback={<VoiceNoteScreenLoading />}>
          <VoiceNoteRecordScreen />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
