import '@src/shared/i18n/init';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { createAiReport } from '../__tests__/report.fixtures';
import { ReportList } from './report-list';

describe('ReportList.Item', () => {
  it('자세히 보기를 누르면 Link와 같은 navigate로 상세를 한 번 연다', async () => {
    // Given
    const report = createAiReport({ id: 42 });
    const href = { pathname: '/reports/[reportId]', params: { reportId: '42' } } as const;
    await renderScreen(<ReportList.Item report={report} href={href} visibility="full" isLast />, {
      withLocalDate: true,
    });

    // When
    await fireEvent.press(screen.getByRole('button', { name: '자세히 보기' }));
    await fireEvent.press(screen.getByRole('button', { name: '자세히 보기' }));

    // Then
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(href);
    expect(router.push).not.toHaveBeenCalled();
  });
});
