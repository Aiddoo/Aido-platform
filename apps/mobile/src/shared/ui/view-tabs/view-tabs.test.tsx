import { renderScreen } from '@src/testing/render';
import { fireEvent, screen } from '@testing-library/react-native';
import { Tabs } from 'heroui-native';
import { Text } from 'react-native';
import { z } from 'zod';

import { ViewTabs } from './view-tabs';

const viewSchema = z.enum(['friends', 'receiver']).catch('friends');

async function renderViewTabs(onValueChange: (view: 'friends' | 'receiver') => void) {
  await renderScreen(
    <ViewTabs schema={viewSchema} value="receiver" onValueChange={onValueChange}>
      <Tabs.List>
        <Tabs.Trigger value="friends" testID="known">
          <Text>친구</Text>
        </Tabs.Trigger>
        <Tabs.Trigger value="unknown" testID="unknown">
          <Text>낯선 탭</Text>
        </Tabs.Trigger>
      </Tabs.List>
    </ViewTabs>,
  );
}

describe('ViewTabs', () => {
  it('스키마가 아는 탭은 그 값을 넘긴다', async () => {
    // Given
    const onValueChange = jest.fn();
    await renderViewTabs(onValueChange);

    // When
    await fireEvent.press(screen.getByTestId('known'));

    // Then
    expect(onValueChange).toHaveBeenCalledWith('friends');
  });

  it('스키마가 모르는 탭은 기본값으로 바꾸지 않고 넘기지 않는다', async () => {
    // Given
    const onValueChange = jest.fn();
    await renderViewTabs(onValueChange);

    // When
    await fireEvent.press(screen.getByTestId('unknown'));

    // Then
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
