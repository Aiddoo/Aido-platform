import { useTranslation } from '@src/shared/i18n';
import { cn } from '@src/shared/utils/cn';
import type { Href } from 'expo-router';

import { HStack } from '../h-stack/h-stack';
import type { HStackProps } from '../h-stack/h-stack.types';
import { ErrorIllustration, type IllustrationSize } from '../illustration';
import { Result } from '../result/result';
import { Text } from '../text/text';
import type { TextProps } from '../text/text.types';
import { VStack } from '../v-stack/v-stack';
import { QueryErrorActions } from './query-error-actions';
import type { QueryErrorFallbackProps as BoundaryFallbackProps } from './query-error-boundary';

interface QueryErrorFallbackProps extends Pick<BoundaryFallbackProps, 'reset'> {
  /** 무엇을 못 불러왔는지 알리는 제목. 없으면 "문제가 생겼어요" */
  title?: string;
  /** 없으면 "잠시 후 다시 시도해주세요. 계속되면 알려주세요" */
  description?: string;
  /** 시트·다이얼로그 안에서는 먼저 닫고 받은 href로 간다 */
  onInquiry?: (href: Href) => void;
  /** 카드 같은 블록 안에서는 그림을 줄인다 */
  illustrationSize?: IllustrationSize;
  className?: string;
}

/** 404처럼 예상한 상태는 기능 fallback이 "없음" 안내를 따로 그린다 */
export function QueryErrorFallback({
  reset,
  title,
  description,
  onInquiry,
  illustrationSize = 'screen',
  className,
}: QueryErrorFallbackProps) {
  const { t } = useTranslation('common');

  return (
    <Result
      className={className}
      icon={<ErrorIllustration size={illustrationSize} />}
      title={title ?? t('errorBoundary.title')}
      description={description ?? t('errorBoundary.description')}
      button={
        <QueryErrorActions testID="query-error-retry" onRetry={reset} onInquiry={onInquiry} />
      }
    />
  );
}

type QueryErrorFallbackInlineProps = Omit<HStackProps, 'children'> &
  Pick<BoundaryFallbackProps, 'reset'> & {
    message: string;
    messageProps?: Omit<TextProps, 'children'>;
    /** 문의하기를 함께 보일 때. 시트·다이얼로그 안에서는 `onInquiry`로 먼저 닫고 받은 href로 간다 */
    hasInquiry?: boolean;
    onInquiry?: (href: Href) => void;
  };

QueryErrorFallback.Inline = function Inline({
  message,
  messageProps,
  reset,
  hasInquiry = false,
  onInquiry,
  ...rowProps
}: QueryErrorFallbackInlineProps) {
  const { t } = useTranslation('common');

  return (
    <HStack gap={8} align="center" {...rowProps}>
      <Text size="b4" shade={6} {...messageProps} className={cn('flex-1', messageProps?.className)}>
        {message}
      </Text>
      {hasInquiry ? (
        <VStack align="center" gap={2}>
          <Result.Button onPress={reset}>{t('actions.retry')}</Result.Button>
          <QueryErrorActions.Inquiry onPress={onInquiry} />
        </VStack>
      ) : (
        <Result.Button onPress={reset}>{t('actions.retry')}</Result.Button>
      )}
    </HStack>
  );
};
