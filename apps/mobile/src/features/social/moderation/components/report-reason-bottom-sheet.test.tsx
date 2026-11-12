import '@src/shared/i18n/init';
import { createHttpClientStub, createTestDi } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
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
});
