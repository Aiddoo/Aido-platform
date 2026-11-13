import { stubWindowDimensions } from '@src/testing/core';
import { renderHook } from '@testing-library/react-native';
import { useIsFocused } from 'expo-router';

import { useOpenDetailWhenCompact } from './use-open-detail-when-compact';

const mockedUseIsFocused = jest.mocked(useIsFocused);

function givenScreen({ isFocused, width }: { isFocused: boolean; width: number }) {
  mockedUseIsFocused.mockReturnValue(isFocused);
  stubWindowDimensions(width);
}

describe('useOpenDetailWhenCompact', () => {
  it('앞에 보이는 화면이 compact가 되면 선택한 항목을 한 번 넘긴다', async () => {
    // Given
    givenScreen({ isFocused: true, width: 390 });
    const openDetail = jest.fn();

    // When
    const { rerender } = await renderHook(() => useOpenDetailWhenCompact(7, openDetail));
    await rerender({});

    // Then
    expect(openDetail).toHaveBeenCalledTimes(1);
    expect(openDetail).toHaveBeenCalledWith(7);
  });

  it('다른 탭이나 상세 화면 뒤에 있으면 넘기지 않는다', async () => {
    // Given
    givenScreen({ isFocused: false, width: 390 });
    const openDetail = jest.fn();

    // When
    await renderHook(() => useOpenDetailWhenCompact(7, openDetail));

    // Then
    expect(openDetail).not.toHaveBeenCalled();
  });

  it('펼친 화면에서는 넘기지 않는다', async () => {
    // Given
    givenScreen({ isFocused: true, width: 900 });
    const openDetail = jest.fn();

    // When
    await renderHook(() => useOpenDetailWhenCompact(7, openDetail));

    // Then
    expect(openDetail).not.toHaveBeenCalled();
  });
});
