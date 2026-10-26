import { useTranslation } from '@src/shared/i18n';
import { router } from 'expo-router';

import { Result } from '../result/result';
import { TextButton } from '../text-button/text-button';
import { VStack } from '../v-stack/v-stack';
import type { QueryErrorFallbackProps } from './query-error-boundary';

/**
 * 예상하지 못한 조회 오류의 기본 화면. 오류 규칙대로 다시 시도와 문의하기 경로를 함께 준다.
 * 404처럼 예상한 상태는 기능 fallback이 "없음" 안내를 따로 그린다.
 */
export function QueryErrorFallback({ reset }: Pick<QueryErrorFallbackProps, 'reset'>) {
  const { t } = useTranslation();

  return (
    <Result
      title={t('errorBoundary.title')}
      description={t('errorBoundary.description')}
      button={
        <VStack align="center" gap={8}>
          <Result.Button onPress={reset}>{t('errorBoundary.retry')}</Result.Button>
          <TextButton
            size="small"
            testID="query-error-inquiry"
            onPress={() => router.push('/settings/inquiry')}
          >
            {t('errorBoundary.inquiry')}
          </TextButton>
        </VStack>
      }
    />
  );
}
