import { AI_SUGGESTION_LIMITS } from '@aido/api/vocabulary';
import { ConsentPolicy } from '@src/features/identity/consent/domains/consent.model';
import { useAiDataSharingConsentGate } from '@src/features/identity/consent/hooks/use-ai-data-sharing-consent-gate';
import { useGetConsentQueryOptions } from '@src/features/identity/consent/queries/consent.queries';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { useTrack, useTrackView } from '@src/shared/analytics';
import { formatDayCountLabel } from '@src/shared/date/format/date-labels';
import type { Instant } from '@src/shared/date/instant';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { dismissToTab } from '@src/shared/navigation/open-entry-href';
import {
  Box,
  Button,
  H4,
  Mascot,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  ScallopedContainer,
  Spacing,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { useIsFetching, useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import { Spinner } from 'heroui-native';
import type { ReactNode } from 'react';
import { match } from 'ts-pattern';

import { SUGGESTION_QUERY_KEYS } from '../queries/suggestion-query-keys';
import { useRequestSuggestionAnalysisMutationOptions } from '../queries/suggestion.mutations';
import { useGetSuggestionsQueryOptions } from '../queries/suggestion.queries';
import { getNextAnalysisLabels } from '../utils/suggestion-schedule.view-model';
import { getSuggestionDisplayState } from '../utils/suggestion-status.view-model';

const SUGGESTION_STATUS_MASCOT_SIZE = 64;

/** 제안 영수증의 머리. 영수증 틀(ScallopedContainer)과 아래 제안 줄은 스크린이 잇는다 */
export function SuggestionStatus() {
  const isFocused = useIsFocused();
  const { data: list } = useSuspenseQuery({
    ...useGetSuggestionsQueryOptions(),
    subscribed: isFocused,
  });
  const analysis = list.analysis;
  const displayState = getSuggestionDisplayState(list);

  useTrackView(
    'ai_suggestions_viewed',
    isFocused
      ? {
          key: displayState,
          params: { state: displayState, suggestion_count: list.suggestions.length },
        }
      : null,
  );

  return match(displayState)
    .with('HAS_SUGGESTIONS', () => (
      <SuggestionStatus.HasSuggestions count={list.suggestions.length} />
    ))
    .with('ANALYZING', () => <SuggestionStatus.Analyzing />)
    .with('DONE_FOR_TODAY', () => (
      <SuggestionStatus.DoneForToday nextAnalysisAt={analysis?.nextAnalysisAt} />
    ))
    .with('NO_PATTERN_FOUND', () => (
      <SuggestionStatus.NoPatternFound nextAnalysisAt={analysis?.nextAnalysisAt} />
    ))
    .with('UNAVAILABLE_TODAY', () => (
      <SuggestionStatus.UnavailableToday nextAnalysisAt={analysis?.nextAnalysisAt} />
    ))
    .with('NEEDS_MORE_TODOS', () => <SuggestionStatus.NeedsMoreTodos />)
    .with('NEEDS_AI_CONSENT', () => <SuggestionStatus.NeedsAiConsent />)
    .with('WAITING_FOR_NEXT_RUN', () => (
      <SuggestionStatus.WaitingForNextRun
        canRequestNow={analysis?.canRequestNow ?? false}
        nextAnalysisAt={analysis?.nextAnalysisAt}
      />
    ))
    .exhaustive();
}

interface NextAnalysisProps {
  nextAnalysisAt?: Instant;
}

interface WaitingForNextRunProps extends NextAnalysisProps {
  canRequestNow: boolean;
}

/** 제안 줄이 바로 아래 이어져 행동 줄 자리를 두지 않는다 */
SuggestionStatus.HasSuggestions = function HasSuggestions({ count }: { count: number }) {
  const { t } = useTranslation('ai');
  return (
    <SuggestionStatus.Message
      title={t('suggestions.status.hasSuggestions', { count })}
      description={t('suggestions.status.hasSuggestionsDescription')}
    />
  );
};

SuggestionStatus.Analyzing = function Analyzing() {
  const { t } = useTranslation('ai');
  return (
    <SuggestionStatus.Message
      title={t('suggestions.status.analyzing')}
      description={t('suggestions.status.analyzingDescription')}
    >
      <SuggestionStatus.ActionRow>
        <Spinner size="sm" />
      </SuggestionStatus.ActionRow>
    </SuggestionStatus.Message>
  );
};

SuggestionStatus.DoneForToday = function DoneForToday({ nextAnalysisAt }: NextAnalysisProps) {
  const { t } = useTranslation('ai');
  return (
    <NextAnalysisMessage
      title={t('suggestions.status.doneForToday')}
      nextAnalysisAt={nextAnalysisAt}
    />
  );
};

SuggestionStatus.NoPatternFound = function NoPatternFound({ nextAnalysisAt }: NextAnalysisProps) {
  const { t } = useTranslation('ai');
  return (
    <NextAnalysisMessage
      title={t('suggestions.status.noPatternFound')}
      nextAnalysisAt={nextAnalysisAt}
    />
  );
};

SuggestionStatus.UnavailableToday = function UnavailableToday({
  nextAnalysisAt,
}: NextAnalysisProps) {
  const { t } = useTranslation('ai');
  return (
    <NextAnalysisMessage
      title={t('suggestions.status.unavailableToday')}
      nextAnalysisAt={nextAnalysisAt}
    />
  );
};

SuggestionStatus.NeedsMoreTodos = function NeedsMoreTodos() {
  const { t } = useTranslation('ai');
  const dateFormatContext = useDateFormatContext();
  // 할 일을 쓰는 원래 자리인 오늘 피드에서 시트를 열어 만든 할 일이 바로 뒤에 보이게 한다
  const leaveToFeed = useSingleTap(dismissToTab);

  const handleAddTodoPress = () =>
    leaveToFeed({ pathname: '/feed', params: { action: 'add-todo' } });

  return (
    <SuggestionStatus.Message
      title={t('suggestions.status.needsMoreTodos')}
      description={t('suggestions.status.needsMoreTodosDescription', {
        period: formatDayCountLabel(AI_SUGGESTION_LIMITS.ANALYSIS_PERIOD_DAYS, dateFormatContext),
      })}
    >
      <SuggestionStatus.ActionRow>
        <Button size="small" display="inline" onPress={handleAddTodoPress}>
          {t('suggestions.status.addTodo')}
        </Button>
      </SuggestionStatus.ActionRow>
    </SuggestionStatus.Message>
  );
};

SuggestionStatus.NeedsAiConsent = function NeedsAiConsent() {
  const { t } = useTranslation('ai');
  const aiConsent = useAiDataSharingConsentGate();
  const { data: consent } = useSuspenseQuery(useGetConsentQueryOptions());
  const isRefreshingStatus = useIsFetching({ queryKey: SUGGESTION_QUERY_KEYS.list() }) > 0;

  // 동의 저장 뒤 상태를 다시 받는 동안만 틀을 둔다. 받은 상태가 여전히 동의 전이면 안내를 다시 보인다
  if (ConsentPolicy.hasAgreedToAiDataSharing(consent) && isRefreshingStatus) {
    return <StatusSkeleton />;
  }

  return (
    <SuggestionStatus.Message
      title={t('consent.notice.suggestions')}
      description={t('suggestions.status.needsAiConsentDescription')}
    >
      <SuggestionStatus.ActionRow>
        <Button size="small" display="inline" onPress={() => aiConsent.requestAgreement()}>
          {t('consent.notice.action')}
        </Button>
      </SuggestionStatus.ActionRow>
    </SuggestionStatus.Message>
  );
};

SuggestionStatus.WaitingForNextRun = function WaitingForNextRun({
  canRequestNow,
  nextAnalysisAt,
}: WaitingForNextRunProps) {
  const { t } = useTranslation('ai');
  const { trackEvent } = useTrack();
  const requestAnalysis = useMutation(useRequestSuggestionAnalysisMutationOptions());

  const handleRequestPress = () => {
    trackEvent('ai_suggestion_analysis_requested', { source: 'suggestions_screen' });
    requestAnalysis.mutate();
  };

  return (
    <NextAnalysisMessage
      title={t('suggestions.status.waitingForNextRun')}
      nextAnalysisAt={nextAnalysisAt}
    >
      {canRequestNow && (
        <Button
          size="small"
          display="inline"
          isLoading={requestAnalysis.isPending}
          onPress={handleRequestPress}
        >
          {t('suggestions.status.requestNow')}
        </Button>
      )}
    </NextAnalysisMessage>
  );
};

interface MessageProps {
  title: string;
  description: string;
  children?: ReactNode;
}

SuggestionStatus.Message = function Message({ title, description, children }: MessageProps) {
  return (
    <StatusLayout
      title={
        <H4 align="center" lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
          {title}
        </H4>
      }
      description={
        <Text
          size="b4"
          shade={6}
          align="center"
          lineBreakStrategyIOS="hangul-word"
          textBreakStrategy="highQuality"
        >
          {description}
        </Text>
      }
    >
      {children}
    </StatusLayout>
  );
};

/**
 * 버튼·스피너 자리. 대기 → 분석 중 → 결과는 폴링으로 제자리에서 바뀌어 비어 있어도 같은 높이를 잡는다.
 * 제안 줄이 이어지는 상태(HasSuggestions·무료 예시)는 목록이 아래를 채워 두지 않는다
 */
SuggestionStatus.ActionRow = function ActionRow({ children }: { children?: ReactNode }) {
  return (
    <>
      <Spacing size={12} />
      <Box className="h-8 items-center justify-center">{children}</Box>
    </>
  );
};

SuggestionStatus.Free = function Free() {
  const { t } = useTranslation('ai');
  return (
    <SuggestionStatus.Message
      title={t('suggestions.paywall.title')}
      description={t('suggestions.paywall.description')}
    />
  );
};

SuggestionStatus.Loading = function Loading() {
  return (
    <ScallopedContainer>
      <StatusSkeleton />
    </ScallopedContainer>
  );
};

SuggestionStatus.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  return (
    <ScallopedContainer>
      <Box className="px-5 py-6">
        <QueryErrorFallback reset={reset} />
      </Box>
    </ScallopedContainer>
  );
};

interface StatusLayoutProps {
  title: ReactNode;
  description: ReactNode;
  children?: ReactNode;
}

function StatusLayout({ title, description, children }: StatusLayoutProps) {
  return (
    <VStack align="center" className="px-5 pt-5 pb-5">
      {/* 몸 아래가 잘린 그림이라 띄워 두면 잘려 보인다. 새 기능 소개·초대 카드처럼 칸 바닥에 앉힌다 */}
      <Box className="h-18 w-24 items-center justify-end overflow-hidden rounded-2xl bg-highlight">
        <Mascot name="catSuggestion" size={SUGGESTION_STATUS_MASCOT_SIZE} />
      </Box>
      <Spacing size={8} />
      {title}
      <Spacing size={4} />
      {description}
      {children}
    </VStack>
  );
}

function StatusSkeleton() {
  return (
    <StatusLayout
      title={<TextSkeleton size="t3" className="w-48" />}
      description={<TextSkeleton size="b4" className="w-56" />}
    >
      <SuggestionStatus.ActionRow />
    </StatusLayout>
  );
}

interface NextAnalysisMessageProps extends NextAnalysisProps {
  title: string;
  children?: ReactNode;
}

function NextAnalysisMessage({ title, nextAnalysisAt, children }: NextAnalysisMessageProps) {
  const { t } = useTranslation('ai');
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const dateFormatContext = useDateFormatContext();
  const description =
    nextAnalysisAt == null
      ? ''
      : t(
          'suggestions.status.nextAnalysisAt',
          getNextAnalysisLabels(nextAnalysisAt, preference.timeFormat, dateFormatContext),
        );

  return (
    <SuggestionStatus.Message title={title} description={description}>
      <SuggestionStatus.ActionRow>{children}</SuggestionStatus.ActionRow>
    </SuggestionStatus.Message>
  );
}
