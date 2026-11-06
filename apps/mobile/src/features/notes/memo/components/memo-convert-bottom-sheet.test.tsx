import '@src/shared/i18n/init';
import { createActivationProgressRepository } from '@src/features/device/activation/apis/activation-progress.repository';
import { ActivationService } from '@src/features/device/activation/apis/activation.service';
import { TodoCategoryService } from '@src/features/planning/category/apis/todo-category.service';
import {
  createHapticsStub,
  createMemorySyncStorage,
  createMockHttpClient,
} from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { ApiError } from '@src/shared/errors/api-error';
import { err, ok } from '@src/shared/errors/result';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider } from '@src/shared/ui';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createMemoTestDi } from '../__tests__/memo.test-utils';
import { MemoConvertBottomSheet } from './memo-convert-bottom-sheet';

const MEMO = { id: 5, content: '장보기' };

async function renderSheet() {
  const httpClient = createMockHttpClient();
  httpClient.get.mockResolvedValue(ok({ categories: [] }));
  const onClose = jest.fn();
  const onConverted = jest.fn();
  await renderUi(
    <LocalDateProvider>
      <OverlayProvider>
        <MemoConvertBottomSheet
          memo={MEMO}
          selectedDate={new Date(2026, 10, 7)}
          categoryId={1}
          isOpen
          onOpenChange={jest.fn()}
          onClose={onClose}
          onConverted={onConverted}
        />
      </OverlayProvider>
    </LocalDateProvider>,
    {
      di: {
        ...createMemoTestDi(httpClient),
        todoCategoryService: new TodoCategoryService(httpClient),
        activationService: new ActivationService(
          createActivationProgressRepository(createMemorySyncStorage()),
        ),
        haptics: createHapticsStub(),
      },
    },
  );

  return { httpClient, onClose, onConverted };
}

async function submit() {
  await act(async () => {
    fireEvent(await screen.findByDisplayValue('장보기'), 'submitEditing');
  });
}

describe('MemoConvertBottomSheet', () => {
  it('메모 내용을 제목으로 채워 변환하고 시트를 닫는다', async () => {
    // Given
    const { httpClient, onClose, onConverted } = await renderSheet();
    httpClient.post.mockResolvedValue(ok({ message: 'converted', todos: [] }));

    // When
    await submit();

    // Then
    await waitFor(() => expect(onConverted).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(httpClient.post).toHaveBeenCalledWith(
      'v1/memos/5/convert-to-todos',
      expect.objectContaining({
        todos: [expect.objectContaining({ title: '장보기', categoryId: 1 })],
      }),
    );
  });

  it('서버가 거절하면 시트와 입력값을 그대로 남긴다', async () => {
    // Given
    const { httpClient, onClose, onConverted } = await renderSheet();
    httpClient.post.mockResolvedValue(err(new ApiError('MEMO_2001', '거절', 400)));

    // When
    await submit();

    // Then
    await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
    expect(onConverted).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('장보기')).toBeTruthy();
  });
});
