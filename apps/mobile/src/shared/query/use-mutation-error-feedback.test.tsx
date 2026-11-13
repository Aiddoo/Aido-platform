import '@src/shared/i18n/init';
import { ApiError } from '@src/core/errors/api-error';
import { NetworkError, ParseError } from '@src/shared/errors';
import { createErrorReporterStub, createHapticsGatewayStub, createTestDi } from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { mutationOptions, useMutation } from '@tanstack/react-query';
import { act, screen } from '@testing-library/react-native';

import { useMutationErrorFeedback } from './use-mutation-error-feedback';

describe('useMutationErrorFeedback', () => {
  async function failSilentMutation(error: unknown) {
    const haptics = createHapticsGatewayStub();
    const errorReporter = createErrorReporterStub();
    const rendered = await renderScreenHook(
      () => {
        const showMutationError = useMutationErrorFeedback();
        return useMutation(
          mutationOptions({
            mutationFn: async (_variables: void) => {
              throw error;
            },
            onError: (failure) => {
              showMutationError(failure, { feature: 'voice', title: '계획을 만들지 못했어요' });
            },
            meta: { errorFeedback: false },
          }),
        );
      },
      { di: createTestDi({ ports: { haptics, errorReporter } }) },
    );

    await act(async () => {
      rendered.result.current.mutate();
    });

    return { haptics, errorReporter };
  }

  it.each<[string, unknown, number]>([
    ['예상하지 못한 실패', new ParseError(), 1],
    ['서버가 코드로 거절한 실패', new ApiError('AI_1303', '한도', 403), 0],
    ['연결 끊김', new NetworkError(), 0],
  ])(
    'errorFeedback이 false여도 %s는 기능 제목 토스트·햅틱 한 번과 보고 %i건이다',
    async (_case, error, reportCount) => {
      // When
      const { haptics, errorReporter } = await failSilentMutation(error);

      // Then
      expect(await screen.findAllByText('계획을 만들지 못했어요')).not.toHaveLength(0);
      expect(haptics.notify).toHaveBeenCalledTimes(1);
      expect(errorReporter.captureException).toHaveBeenCalledTimes(reportCount);
    },
  );
});
