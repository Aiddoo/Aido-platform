import { createAnalyticsStub, createTestDi } from '@src/testing/core';
import { renderScreen, renderScreenHook } from '@src/testing/render';
import { Activity } from 'react';

import type { AnalyticsViewTab } from './event-vocabulary';
import { useTrackView } from './use-track-view';

type ViewKey = AnalyticsViewTab | null;

function useTabView(key: ViewKey) {
  useTrackView(
    'view_tab_changed',
    key == null ? null : { key, params: { screen_name: '/feed', view: key } },
  );
}

describe('useTrackView', () => {
  it.each<{ name: string; keys: ViewKey[]; expected: AnalyticsViewTab[] }>([
    {
      name: 'params 객체만 새로 만들어 다시 그리면',
      keys: ['WEEKLY', 'WEEKLY'],
      expected: ['WEEKLY'],
    },
    {
      name: 'key가 바뀌었다 돌아오면',
      keys: ['WEEKLY', 'MONTHLY', 'WEEKLY'],
      expected: ['WEEKLY', 'MONTHLY'],
    },
    { name: '숨었다 다시 보이면', keys: [null, 'WEEKLY', null, 'WEEKLY'], expected: ['WEEKLY'] },
  ])('$name 마운트 안에서 key마다 한 번만 보낸다', async ({ keys, expected }) => {
    // Given
    const [firstKey = null, ...nextKeys] = keys;
    const analytics = createAnalyticsStub();
    const { rerender } = await renderScreenHook(useTabView, {
      di: createTestDi({ ports: { analytics } }),
      initialProps: firstKey,
    });

    // When
    for (const key of nextKeys) {
      await rerender(key);
    }

    // Then
    expect(analytics.trackEvent.mock.calls).toEqual(
      expected.map((view) => ['view_tab_changed', { screen_name: '/feed', view }]),
    );
  });

  it('StrictMode처럼 상태는 남고 효과만 다시 돌아도 한 번 보낸다', async () => {
    // Given
    const analytics = createAnalyticsStub();
    function Probe() {
      useTabView('WEEKLY');
      return null;
    }
    const probe = <Probe />;
    // 이 테스트 렌더러는 StrictMode의 effect 재실행을 하지 않아, 같은 일을 하는 Activity로 effect를 정리했다 다시 건다
    const { rerender } = await renderScreen(<Activity mode="visible">{probe}</Activity>, {
      di: createTestDi({ ports: { analytics } }),
    });

    // When
    await rerender(<Activity mode="hidden">{probe}</Activity>);
    await rerender(<Activity mode="visible">{probe}</Activity>);

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledTimes(1);
  });
});
