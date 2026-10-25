import '@src/shared/i18n/init';
import { render, screen } from '@testing-library/react-native';

import type { ActivationProgress } from '../domains/activation.model';
import { useActivationChecklist } from '../hooks/use-activation-progress';
import { ActivationChecklist } from './activation-checklist';

jest.mock('../hooks/use-activation-progress', () => ({ useActivationChecklist: jest.fn() }));

function givenChecklist(progress: ActivationProgress, isVisible = true) {
  jest.mocked(useActivationChecklist).mockReturnValue({ progress, isVisible });
}

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
    // Given
    givenChecklist({ todoCreatedAt: null, activatedAt: null, pushRegistrationUnlockedAt: null });

    // When
    await render(<ActivationChecklist />);

    // Then
    expect(screen.getByText('첫 할 일을 만들고 완료해 보세요')).toBeTruthy();
    expect(screen.getByLabelText('첫 할 일 만들기, 미완료')).toBeTruthy();
    expect(screen.getByLabelText('만든 할 일 완료하기, 미완료')).toBeTruthy();
  });

  it('생성 후에는 첫 단계만 완료로 표시한다', async () => {
    // Given
    givenChecklist({
      todoCreatedAt: new Date('2026-08-02T00:00:00.000Z'),
      activatedAt: null,
      pushRegistrationUnlockedAt: null,
    });

    // When
    await render(<ActivationChecklist />);

    // Then
    expect(screen.getByLabelText('첫 할 일 만들기, 완료')).toBeTruthy();
    expect(screen.getByLabelText('만든 할 일 완료하기, 미완료')).toBeTruthy();
  });

  it('노출 조건이 아니면 아무것도 그리지 않는다', async () => {
    // Given
    givenChecklist(
      { todoCreatedAt: null, activatedAt: null, pushRegistrationUnlockedAt: null },
      false,
    );

    // When
    await render(<ActivationChecklist />);

    // Then
    expect(screen.queryByText('첫 할 일을 만들고 완료해 보세요')).toBeNull();
  });
});
