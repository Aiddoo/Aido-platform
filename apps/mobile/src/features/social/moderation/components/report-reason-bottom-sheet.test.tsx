import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { createHttpClientStub, createTestDi } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createProfileReportTarget } from '../domains/user-report.model';
import { ReportReasonBottomSheet } from './report-reason-bottom-sheet';

describe('ReportReasonBottomSheet', () => {
  it('신고하기를 같은 프레임에 두 번 눌러도 신고는 한 번만 보낸다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.post.mockReturnValue(new Promise(() => {}));
    await renderScreen(
      <ReportReasonBottomSheet
        target={createProfileReportTarget({ userId: 'user-2' })}
        targetDisplayName="홍길동"
      />,
      { di: createTestDi({ ports: { httpClient } }), withOverlay: true, withLocalDate: true },
    );
    await fireEvent.press(await screen.findByText('스팸·광고'));
    const submit = screen.getByRole('button', { name: '신고하기' });

    // When
    await act(async () => {
      fireEvent.press(submit);
      fireEvent.press(submit);
    });

    // Then
    await waitFor(() => expect(httpClient.post).toHaveBeenCalled());
    expect(httpClient.post).toHaveBeenCalledTimes(1);
  });

  describe('신고 뒤 떠나는 동안', () => {
    setupFakeTimersPerTest();

    it('신고해 시트가 내려가는 동안 다시 눌러도 신고는 한 번만 보낸다', async () => {
      // Given
      const httpClient = createHttpClientStub();
      httpClient.post.mockResolvedValue(
        ok({
          message: '신고를 접수했습니다.',
          report: {
            id: 'clz7x5p8k0123qz0z8z8z8z8z',
            status: 'OPEN',
            createdAt: '2026-10-26T09:00:00.000Z',
          },
        }),
      );
      await renderScreen(
        <ReportReasonBottomSheet
          target={createProfileReportTarget({ userId: 'user-2' })}
          targetDisplayName="홍길동"
        />,
        { di: createTestDi({ ports: { httpClient } }), withOverlay: true, withLocalDate: true },
      );
      await fireEvent.press(await screen.findByText('스팸·광고'));
      await fireEvent.press(screen.getByTestId('report-submit'));
      // 연타 가드(600ms)가 지난 뒤다. 시트는 닫힘 애니메이션이 끝나야 내려가 버튼이 아직 보인다
      await act(() => jest.advanceTimersByTimeAsync(1_000));
      expect(httpClient.post).toHaveBeenCalledTimes(1);

      // When
      await fireEvent.press(screen.getByTestId('report-submit'));
      await act(() => jest.advanceTimersByTimeAsync(1_000));

      // Then
      expect(httpClient.post).toHaveBeenCalledTimes(1);
    });
  });
});
