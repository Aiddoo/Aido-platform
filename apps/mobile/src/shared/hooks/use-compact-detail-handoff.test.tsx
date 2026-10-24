import { mockWindowDimensions } from '@src/shared/__tests__';
import { renderHook } from '@testing-library/react-native';
import { useIsFocused } from 'expo-router';

import { useCompactDetailHandoff } from './use-compact-detail-handoff';

jest.mock('expo-router', () => ({ useIsFocused: jest.fn() }));

const mockedUseIsFocused = jest.mocked(useIsFocused);

async function renderHandoff({ isFocused, width }: { isFocused: boolean; width: number }) {
  mockedUseIsFocused.mockReturnValue(isFocused);
  mockWindowDimensions(width);
  const openDetail = jest.fn();

  const result = await renderHook(() => useCompactDetailHandoff(7, openDetail));

  return { openDetail, ...result };
}

describe('useCompactDetailHandoff', () => {
  it('앞에 보이는 화면이 compact가 되면 선택한 항목을 한 번 넘긴다', async () => {
    const { openDetail, rerender } = await renderHandoff({ isFocused: true, width: 390 });

    await rerender({});

    expect(openDetail).toHaveBeenCalledTimes(1);
    expect(openDetail).toHaveBeenCalledWith(7);
  });

  it('다른 탭이나 상세 화면 뒤에 있으면 넘기지 않는다', async () => {
    const { openDetail } = await renderHandoff({ isFocused: false, width: 390 });

    expect(openDetail).not.toHaveBeenCalled();
  });

  it('펼친 화면에서는 넘기지 않는다', async () => {
    const { openDetail } = await renderHandoff({ isFocused: true, width: 900 });

    expect(openDetail).not.toHaveBeenCalled();
  });
});
