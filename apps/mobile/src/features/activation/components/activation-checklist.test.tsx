import '@src/shared/i18n/init';
import { createStubInviteService } from '@src/features/invite/__tests__/create-stub-invite-service';
import { createInviteDto } from '@src/features/invite/__tests__/invite.factories';
import { createMockAnalytics, createMockHttpClient } from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import type { ActivationProgress } from '../domains/activation.model';
import { useActivationChecklist } from '../hooks/use-activation-progress';
import { ActivationChecklist } from './activation-checklist';

jest.mock('../hooks/use-activation-progress', () => ({ useActivationChecklist: jest.fn() }));

function givenChecklist(progress: ActivationProgress, isVisible = true) {
  jest.mocked(useActivationChecklist).mockReturnValue({ progress, isVisible });
}

// 초대 기능이 꺼진 상태(기존 두 단계)만 본다. 서버가 꺼짐을 돌려주는 실제 InviteService를 주입한다
function renderChecklist() {
  const publicHttpClient = createMockHttpClient();
  publicHttpClient.get.mockResolvedValue({ ok: true, value: { enabled: false } });

  return renderUi(<ActivationChecklist />, {
    di: {
      inviteService: createStubInviteService({ publicHttpClient }),
      analytics: createMockAnalytics(),
    },
  });
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

const NOT_STARTED = { todoCreatedAt: null, activatedAt: null, pushRegistrationUnlockedAt: null };

// 초대 기능이 켜진 상태. 사용 가능 여부와 내 초대 요약을 실제 InviteService가 HTTP stub에서 읽는다
async function renderChecklistWithInvite(invite: ReturnType<typeof createInviteDto>) {
  const publicHttpClient = createMockHttpClient();
  publicHttpClient.get.mockResolvedValue({ ok: true, value: { enabled: true } });
  const authHttpClient = createMockHttpClient();
  authHttpClient.get.mockResolvedValue({ ok: true, value: invite });
  const analytics = createMockAnalytics();

  await renderUi(<ActivationChecklist />, {
    di: {
      inviteService: createStubInviteService({ publicHttpClient, authHttpClient }),
      analytics,
    },
  });

  return { analytics };
}

describe('ActivationChecklist', () => {
  it('생성 전에는 두 단계를 모두 미완료로 안내한다', async () => {
    // Given
    givenChecklist({ todoCreatedAt: null, activatedAt: null, pushRegistrationUnlockedAt: null });

    // When
    await renderChecklist();

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
    await renderChecklist();

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
    await renderChecklist();

    // Then
    expect(screen.queryByText('첫 할 일을 만들고 완료해 보세요')).toBeNull();
  });

  describe('친구 초대 단계', () => {
    it('초대 기능이 켜졌고 아직 아무도 가입하지 않았으면 친구가 받는 보상과 함께 미완료로 보인다', async () => {
      // Given
      givenChecklist(NOT_STARTED);

      // When
      await renderChecklistWithInvite(createInviteDto({ waitingCount: 0, qualifiedCount: 0 }));

      // Then 보상은 초대한 내가 아니라 친구가 받는 것이라고 읽힌다
      expect(await screen.findByLabelText('친구 1명 초대하기, 미완료')).toBeTruthy();
      expect(screen.getByText('친구에게 프리미엄 7일')).toBeTruthy();
    });

    it('누르면 체크리스트에서 들어왔다고 남기고 내 초대 화면을 연다', async () => {
      // Given
      givenChecklist(NOT_STARTED);
      const { analytics } = await renderChecklistWithInvite(
        createInviteDto({ waitingCount: 0, qualifiedCount: 0 }),
      );

      // When
      fireEvent.press(await screen.findByLabelText('친구 1명 초대하기, 미완료'));

      // Then
      expect(analytics.trackEvent).toHaveBeenCalledWith('invite_entry_tapped', {
        entry: 'activation_checklist',
      });
      expect(router.push).toHaveBeenCalledTimes(1);
    });

    it('한 명이라도 가입하면 완료로 보이고 보상 문구를 감춘다', async () => {
      // Given
      givenChecklist(NOT_STARTED);

      // When
      await renderChecklistWithInvite(createInviteDto({ waitingCount: 1, qualifiedCount: 0 }));

      // Then
      expect(await screen.findByLabelText('친구 1명 초대하기, 완료')).toBeTruthy();
      expect(screen.queryByText('친구에게 프리미엄 7일')).toBeNull();
    });
  });
});
