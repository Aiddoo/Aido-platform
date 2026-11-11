import { getCalendarHeaderLayout } from './calendar-header.geometry';

// 영어 기본 글자 크기에서 잰 폭에 가깝다. 한 줄 폭은 120 + 50 + 111 + 60 + 간격 8 × 3 = 365다
const HEADER_WIDTHS = {
  gap: 8,
  widestTitleWidth: 120,
  todayWidth: 50,
  viewModeTabsWidth: 111,
  navigationWidth: 60,
};

describe('getCalendarHeaderLayout', () => {
  it('가장 긴 제목까지 한 줄 폭이 헤더 폭과 꼭 같으면 한 줄로 둔다', () => {
    // When
    const layout = getCalendarHeaderLayout({ ...HEADER_WIDTHS, availableWidth: 365 });

    // Then
    expect(layout).toBe('inline');
  });

  it('한 줄 폭이 헤더 폭을 1pt라도 넘으면 제목 줄과 버튼 줄로 나눈다', () => {
    // When
    const layout = getCalendarHeaderLayout({ ...HEADER_WIDTHS, availableWidth: 364 });

    // Then
    expect(layout).toBe('stacked');
  });
});
