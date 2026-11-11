import '@src/shared/i18n/init';
import { ApiError } from '@src/core/errors/api-error';
import {
  createErrorReporterStub,
  createHapticsGatewayStub,
  createTestQueryClient,
  renderUiHook,
} from '@src/shared/__tests__';
import type { AppMutationMeta } from '@src/shared/constants/query-meta';
import { NetworkError, ParseError } from '@src/shared/errors';
import { i18n } from '@src/shared/i18n';
import { mutationOptions, useMutation } from '@tanstack/react-query';
import { act, screen } from '@testing-library/react-native';
import { noop } from 'es-toolkit';

const FALLBACK_KEY = 'todo:toast.addFailedRetry';
const GLOBAL_FEEDBACK: AppMutationMeta = {
  errorFeedback: { feature: 'todo', fallbackKey: FALLBACK_KEY },
};

async function failMutation(
  error: unknown,
  { meta, onSettled }: { meta: AppMutationMeta; onSettled?: () => Promise<unknown> },
) {
  const haptics = createHapticsGatewayStub();
  const errorReporter = createErrorReporterStub();
  const rendered = await renderUiHook(
    () =>
      useMutation(
        mutationOptions({
          mutationFn: async (_variables: void) => {
            throw error;
          },
          onSettled,
          meta,
        }),
      ),
    { di: { haptics, errorReporter } },
  );

  await act(async () => {
    rendered.result.current.mutate();
  });

  return { ...rendered, haptics, errorReporter };
}

describe('MutationErrorFeedback', () => {
  it('사용자 문구가 없는 오류는 대체 문구로 한 번 알리고 기능 이름으로 보고한다', async () => {
    // Given
    const error = new ParseError('[TodoApi] Invalid createTodo response');

    // When
    const { haptics, errorReporter } = await failMutation(error, { meta: GLOBAL_FEEDBACK });

    // Then
    expect(await screen.findAllByText(i18n.t(FALLBACK_KEY))).not.toHaveLength(0);
    expect(haptics.notify).toHaveBeenCalledTimes(1);
    expect(haptics.notify).toHaveBeenCalledWith('error');
    expect(errorReporter.captureException).toHaveBeenCalledTimes(1);
    expect(errorReporter.captureException).toHaveBeenCalledWith(error, { feature: 'todo' });
  });

  it('서버가 코드로 거절한 오류는 서버 문구로 알리고 보고하지 않는다', async () => {
    // Given
    const rejection = new ApiError('TODO_0801', '할 일을 찾을 수 없어요', 404);

    // When
    const { errorReporter } = await failMutation(rejection, { meta: GLOBAL_FEEDBACK });

    // Then
    expect(await screen.findAllByText(rejection.message)).not.toHaveLength(0);
    expect(errorReporter.captureException).not.toHaveBeenCalled();
  });

  it('연결 오류는 연결 문구로 알리고 보고하지 않는다', async () => {
    // Given
    const disconnection = new NetworkError();

    // When
    const { errorReporter } = await failMutation(disconnection, { meta: GLOBAL_FEEDBACK });

    // Then
    expect(await screen.findAllByText(disconnection.message)).not.toHaveLength(0);
    expect(errorReporter.captureException).not.toHaveBeenCalled();
  });

  it('기능이 직접 보이는 오류와 errorFeedback이 false인 mutation에는 아무것도 더하지 않는다', async () => {
    // Given
    const error = new ParseError();
    const handledByFeature: AppMutationMeta = {
      errorFeedback: { feature: 'todo', fallbackKey: FALLBACK_KEY, isHandledByFeature: () => true },
    };

    // When
    const handled = await failMutation(error, { meta: handledByFeature });
    const silent = await failMutation(error, { meta: { errorFeedback: false } });

    // Then
    expect(screen.queryByText(i18n.t(FALLBACK_KEY))).toBeNull();
    for (const { haptics, errorReporter } of [handled, silent]) {
      expect(haptics.notify).not.toHaveBeenCalled();
      expect(errorReporter.captureException).not.toHaveBeenCalled();
    }
  });

  it('onSettled가 다시 받기를 기다리는 동안에도 실패를 바로 알린다', async () => {
    // Given
    const refetchPausedOffline = () => new Promise<never>(noop);

    // When
    const { haptics } = await failMutation(new NetworkError(), {
      meta: GLOBAL_FEEDBACK,
      onSettled: refetchPausedOffline,
    });

    // Then
    expect(haptics.notify).toHaveBeenCalledWith('error');
    expect(await screen.findAllByText(new NetworkError().message)).not.toHaveLength(0);
  });

  it('화면 트리가 내려가면 구독을 풀어 뒤늦은 실패를 알리지 않는다', async () => {
    // Given
    const queryClient = createTestQueryClient();
    const haptics = createHapticsGatewayStub();
    const { unmount } = await renderUiHook(() => null, { queryClient, di: { haptics } });
    await act(async () => {
      unmount();
    });

    // When
    await queryClient
      .getMutationCache()
      .build(queryClient, {
        mutationFn: async () => {
          throw new ParseError();
        },
        meta: GLOBAL_FEEDBACK,
      })
      .execute(undefined)
      .catch(noop);

    // Then
    expect(haptics.notify).not.toHaveBeenCalled();
  });
});
