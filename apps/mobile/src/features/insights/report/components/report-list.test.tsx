import '@src/shared/i18n/init';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { getSampleReport, SAMPLE_REPORT_IDS } from '../constants/sample-reports.constants';
import { ReportList } from './report-list';

describe('ReportList.Item', () => {
  it('자세히 보기를 누르면 Link와 같은 navigate로 상세를 한 번 연다', async () => {
    // Given
    const report = getSampleReport(SAMPLE_REPORT_IDS.WEEKLY);
    await renderScreen(<ReportList.Item report={report} isSample isLast />, {
      withLocalDate: true,
    });

    // When
    await fireEvent.press(screen.getByRole('button', { name: '자세히 보기' }));
    await fireEvent.press(screen.getByRole('button', { name: '자세히 보기' }));

    // Then
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/reports/[reportId]',
      params: { reportId: SAMPLE_REPORT_IDS.WEEKLY },
    });
    expect(router.push).not.toHaveBeenCalled();
  });
});
