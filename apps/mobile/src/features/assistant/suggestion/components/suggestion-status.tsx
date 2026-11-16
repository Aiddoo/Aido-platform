import { AiConsentNotice } from '@src/features/identity/consent/components/ai-consent-notice';
import { ConsentPolicy } from '@src/features/identity/consent/domains/consent.model';
import { useGetConsentQueryOptions } from '@src/features/identity/consent/queries/consent.queries';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { useTrack, useTrackView } from '@src/shared/analytics';
import type { Instant } from '@src/shared/date/instant';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  H4,
  Mascot,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  Spacing,
  SurfaceCard,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { router, useIsFocused } from 'expo-router';
import { Spinner } from 'heroui-native';
import type { ReactNode } from 'react';
import { match } from 'ts-pattern';

import { isSuggestionsPremiumRequiredError } from '../domains/suggestion.error';
import { useRequestSuggestionAnalysisMutationOptions } from '../queries/suggestion.mutations';
import { useGetSuggestionsQueryOptions } from '../queries/suggestion.queries';
import { formatNextAnalysisAt } from '../utils/suggestion-schedule.view-model';
import { getSuggestionDisplayState } from '../utils/suggestion-status.view-model';

const SUGGESTION_STATUS_MASCOT_SIZE = 100;

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

  return (
    <SurfaceCard testID="suggestions-status">
      {match(displayState)
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
        .exhaustive()}
    </SurfaceCard>
  );
}

interface NextAnalysisProps {
  nextAnalysisAt?: Instant;
}

interface WaitingForNextRunProps extends NextAnalysisProps {
  canRequestNow: boolean;
}

SuggestionStatus.HasSuggestions = function HasSuggestions({ count }: { count: number }) {
  const { t } = useTranslation('ai');
  return (
    <StatusMessage
      title={t('suggestions.status.hasSuggestions', { count })}
      description={t('suggestions.status.hasSuggestionsDescription')}
    />
  );
};

SuggestionStatus.Analyzing = function Analyzing() {
  const { t } = useTranslation('ai');
  const spinnerColor = useResolvedColor('text-main');
  return (
    <StatusMessage
      title={t('suggestions.status.analyzing')}
      description={t('suggestions.status.analyzingDescription')}
    >
      <Spinner size="sm" color={spinnerColor} />
    </StatusMessage>
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
  const todayKey = useTodayKey();
  const push = useSingleTap(router.push);

  const handleAddTodoPress = () => push({ pathname: '/todo/new', params: { date: todayKey } });

  return (
    <StatusMessage
      title={t('suggestions.status.needsMoreTodos')}
      description={t('suggestions.status.needsMoreTodosDescription')}
    >
      <Button size="small" display="inline" onPress={handleAddTodoPress}>
        {t('suggestions.status.addTodo')}
      </Button>
    </StatusMessage>
  );
};

SuggestionStatus.NeedsAiConsent = function NeedsAiConsent() {
  const { t } = useTranslation('ai');
  const { data: consent } = useSuspenseQuery(useGetConsentQueryOptions());

  // 동의를 저장하면 안내는 바로 숨고 제안 상태는 다시 받는 중이라 그동안 빈 카드 대신 받는 중 틀을 둔다
  if (ConsentPolicy.hasAgreedToAiDataSharing(consent)) {
    return <StatusSkeleton />;
  }

  return <AiConsentNotice title={t('consent.notice.suggestions')} />;
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

SuggestionStatus.Loading = function Loading() {
  return (
    <SurfaceCard>
      <StatusSkeleton />
    </SurfaceCard>
  );
};

SuggestionStatus.Error = function ErrorFallback({ error, reset }: QueryErrorFallbackProps) {
  if (isSuggestionsPremiumRequiredError(error)) {
    return null;
  }

  return (
    <SurfaceCard>
      <Box className="px-5 py-6">
        <QueryErrorFallback reset={reset} />
      </Box>
    </SurfaceCard>
  );
};

interface StatusLayoutProps {
  title: ReactNode;
  description: ReactNode;
  children?: ReactNode;
}

function StatusLayout({ title, description, children }: StatusLayoutProps) {
  return (
    <VStack align="center" className="px-5 pt-4 pb-5">
      <Mascot name="catSuggestion" size={SUGGESTION_STATUS_MASCOT_SIZE} />
      <Spacing size={8} />
      {title}
      <Spacing size={4} />
      {description}
      <Spacing size={12} />
      <Box className="h-8 items-center justify-center">{children}</Box>
    </VStack>
  );
}

function StatusSkeleton() {
  return (
    <StatusLayout
      title={<TextSkeleton size="t3" className="w-48" />}
      description={<TextSkeleton size="b4" className="w-56" />}
    />
  );
}

interface StatusMessageProps {
  title: string;
  description: string;
  children?: ReactNode;
}

function StatusMessage({ title, description, children }: StatusMessageProps) {
  return (
    <StatusLayout
      title={
        <H4 align="center" lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
          {title}
        </H4>
      }
      description={
        <Text size="b4" shade={6} align="center">
          {description}
        </Text>
      }
    >
      {children}
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
      : t('suggestions.status.nextAnalysisAt', {
          time: formatNextAnalysisAt(nextAnalysisAt, preference.timeFormat, dateFormatContext),
        });

  return (
    <StatusMessage title={title} description={description}>
      {children}
    </StatusMessage>
  );
}
