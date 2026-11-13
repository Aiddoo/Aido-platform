import { createAnalyticsStub, createTestDi } from '@src/testing/core';
import { renderScreen, renderScreenHook } from '@src/testing/render';
import { StrictMode } from 'react';

import { useTrackView } from './use-track-view';

type ViewKey = string | null;

function useTabView(key: ViewKey) {
  useTrackView(
    'view_tab_changed',
    key == null ? null : { key, params: { screen_name: '/feed', view: key } },
  );
}

describe('useTrackView', () => {
  it.each<{ name: string; keys: ViewKey[]; expected: string[] }>([
    { name: 'params 객체만 새로 만들어 다시 그리면', keys: ['week', 'week'], expected: ['week'] },
    {
      name: 'key가 바뀌었다 돌아오면',
      keys: ['week', 'month', 'week'],
      expected: ['week', 'month'],
    },
    { name: '숨었다 다시 보이면', keys: [null, 'week', null, 'week'], expected: ['week'] },
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

  it('StrictMode가 효과를 두 번 돌려도 한 번 보낸다', async () => {
    // Given
    const analytics = createAnalyticsStub();
    function Probe() {
      useTabView('week');
      return null;
    }

    // When
    await renderScreen(
      <StrictMode>
        <Probe />
      </StrictMode>,
      { di: createTestDi({ ports: { analytics } }) },
    );

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledTimes(1);
  });
});
