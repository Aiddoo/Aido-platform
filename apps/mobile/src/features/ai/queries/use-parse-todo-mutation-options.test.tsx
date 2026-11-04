import '@src/shared/i18n/init';
import { ErrorCode } from '@aido/api/errors';
import { createEntitlementSnapshotDto } from '@src/features/subscription/__tests__/entitlement.factories';
import { EntitlementService } from '@src/features/subscription/apis/entitlement.service';
import {
  createErrorReporterStub,
  createMockAnalytics,
  createMockHttpClient,
} from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { ApiError } from '@src/shared/errors/api-error';
import { err, ok } from '@src/shared/errors/result';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { Button } from '@src/shared/ui';
import { OverlayProvider } from '@src/shared/ui/overlay/overlay-provider';
import { useMutation } from '@tanstack/react-query';
import { fireEvent, screen } from '@testing-library/react-native';

import { AiService } from '../apis/ai.service';
import { useParseTodoMutationOptions } from './use-parse-todo-mutation-options';

const silentLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

function ParseTodoHarness() {
  const parse = useMutation(useParseTodoMutationOptions());
  return <Button onPress={() => parse.mutate({ text: '내일 회의' })}>정리하기</Button>;
}

async function renderParseTodo(error: ApiError) {
  const httpClient = createMockHttpClient();
  httpClient.post.mockResolvedValue(err(error));
  httpClient.get.mockResolvedValue(ok(createEntitlementSnapshotDto()));

  await renderUi(
    <LocalDateProvider>
      <OverlayProvider>
        <ParseTodoHarness />
      </OverlayProvider>
    </LocalDateProvider>,
    {
      di: {
        aiService: new AiService(httpClient, silentLogger),
        entitlementService: new EntitlementService(httpClient, silentLogger),
        analytics: createMockAnalytics(),
        errorReporter: createErrorReporterStub(),
      },
    },
  );
}

describe('useParseTodoMutationOptions', () => {
  it('AI 정리가 실패했지만 차감하지 않았다고 서버가 알리면 그 사실을 함께 보여 준다', async () => {
    // Given
    await renderParseTodo(
      new ApiError(ErrorCode.AI_1314, '아직 처리하고 있어요', 409, { charged: false }),
    );

    // When
    fireEvent.press(screen.getByText('정리하기'));

    // Then
    expect(await screen.findAllByText('횟수는 차감되지 않았어요')).not.toHaveLength(0);
  });

  it('차감 여부를 모르는 실패에는 덧붙이지 않는다', async () => {
    // Given
    await renderParseTodo(new ApiError(ErrorCode.AI_1302, '문장을 이해하지 못했어요', 422));

    // When
    fireEvent.press(screen.getByText('정리하기'));

    // Then
    expect(await screen.findAllByText('문장을 이해하지 못했어요')).not.toHaveLength(0);
    expect(screen.queryAllByText('횟수는 차감되지 않았어요')).toHaveLength(0);
  });
});
