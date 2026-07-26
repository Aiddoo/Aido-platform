import '@src/shared/i18n/init';
import { render, screen } from '@testing-library/react-native';
import { ActivationChecklist } from './ActivationChecklist';

jest.mock('@src/shared/ui', () => {
  const React = require('react');
  const { Text: NativeText, View } = require('react-native');
  const Container = ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement(View, props, children);
  const Text = ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
    React.createElement(NativeText, props, children);
  return {
    Box: Container,
    HStack: Container,
    VStack: Container,
    Text,
    CheckIcon: () => null,
  };
});

describe('ActivationChecklist', () => {
  it('생성 전에는 두 단계를 모두 미완료로 안내한다', async () => {
    // When
    await render(
      <ActivationChecklist
        progress={{
          todoCreatedAt: null,
          activatedAt: null,
          pushRegistrationUnlockedAt: null,
        }}
      />,
    );

    // Then
    expect(screen.getByText('첫 할 일을 만들고 완료해 보세요')).toBeTruthy();
    expect(screen.getByLabelText('첫 할 일 만들기, 미완료')).toBeTruthy();
    expect(screen.getByLabelText('만든 할 일 완료하기, 미완료')).toBeTruthy();
  });

  it('생성 후에는 첫 단계만 완료로 표시한다', async () => {
    // When
    await render(
      <ActivationChecklist
        progress={{
          todoCreatedAt: new Date('2026-08-02T00:00:00.000Z'),
          activatedAt: null,
          pushRegistrationUnlockedAt: null,
        }}
      />,
    );

    // Then
    expect(screen.getByLabelText('첫 할 일 만들기, 완료')).toBeTruthy();
    expect(screen.getByLabelText('만든 할 일 완료하기, 미완료')).toBeTruthy();
  });
});
