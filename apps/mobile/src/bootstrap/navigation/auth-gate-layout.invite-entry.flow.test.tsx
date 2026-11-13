import '@src/shared/i18n/init';
import { INVITE_REDEEM_WINDOW_DAYS } from '@aido/api/vocabulary';
import { ApiError } from '@src/core/errors/api-error';
import { err, ok } from '@src/core/errors/result';
import type { AuthStatus } from '@src/core/session/auth-status';
import { createAuthSessionStoreStub } from '@src/features/identity/auth/__tests__/create-auth-session-store-stub';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import {
  createInviteApiError,
  createInvitePreviewDto,
  createRedeemResponseDto,
} from '@src/features/social/invite/__tests__/invite.fixtures';
import { InviteWelcomeBottomSheet } from '@src/features/social/invite/components/invite-welcome-bottom-sheet';
import { pendingRedemptionStoredValue } from '@src/features/social/invite/schemas/pending-redemption-storage.schema';
import { ENV } from '@src/shared/config/env';
import { DAY_MS } from '@src/shared/constants/time-units';
import { readStoredValue } from '@src/shared/storage/define-stored-value';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createMemorySyncStorage,
  createTestDi,
  respondByPath,
  stubWindowDimensions,
} from '@src/testing/core';
import { renderAppRoute } from '@src/testing/render-route-hook';
import * as ExpoLinking from 'expo-linking';
import { router, Stack, Tabs, useLocalSearchParams } from 'expo-router';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { Linking, Pressable, Text } from 'react-native';

import { unstable_settings as meTabSettings } from '../../../app/(app)/(tabs)/(me)/_layout';
import { unstable_settings as memosTabSettings } from '../../../app/(app)/(tabs)/(memos)/_layout';
import { unstable_settings as todosTabSettings } from '../../../app/(app)/(tabs)/(todos)/_layout';
import { unstable_settings as tabsSettings } from '../../../app/(app)/(tabs)/_layout';
import * as NativeIntent from '../../../app/+native-intent';
import OAuthCallbackScreen from '../../../app/auth/[provider]';
import RootIndex from '../../../app/index';
import InviteCardScreen from '../../../app/invite/[inviteCode]';
import InviteLayout from '../../../app/invite/_layout';
import InviteCodeEntryRoute from '../../../app/invite/index';
import { AuthGateLayout } from './auth-gate-layout';

// 실제 라우터로 URL·탭·뒤로 가기 목적지를 검증하므로 jest.setup의 전역 mock을 끈다
jest.unmock('expo-router');

type SystemUrlListener = (event: { url: string }) => void;

// expo-router 시험 도구는 OS 링크 구독을 빈 함수로 막는다. 켜진 앱에 들어오는 링크를 흘릴 수 있게 구독을 모은다
const systemUrlListeners = new Set<SystemUrlListener>();
Object.assign(jest.requireMock<Record<string, unknown>>('expo-linking'), {
  addEventListener: (_type: 'url', listener: SystemUrlListener) => {
    systemUrlListeners.add(listener);
    return { remove: () => systemUrlListeners.delete(listener) };
  },
});

const INVITE_CODE = 'K7M2QX';
const INVITER_ID = createRedeemResponseDto().inviter.userId;
const SHARED_INVITE_LINK = `https://aido.kr/i/${INVITE_CODE}`;

type RedeemResponse = ApiError | ReturnType<typeof createRedeemResponseDto>;

interface SetupOptions {
  status: AuthStatus;
  /** 시스템이 연 URL. `+native-intent`를 거쳐 첫 화면을 정한다 */
  systemUrl?: string;
  /** 앱 안 경로. 켜 둔 앱의 지금 화면 */
  url?: string;
  preview?: 'found' | 'not-found';
  redeem?: RedeemResponse;
  syncStorage?: ReturnType<typeof createMemorySyncStorage>;
}

/** 피드가 실제로 받은 params. 앱 전체 URL 값에는 앞 화면 param이 남을 수 있어 화면이 읽는 값을 본다 */
function FeedScreen() {
  return <Text testID="feed">{JSON.stringify(useLocalSearchParams())}</Text>;
}

function feedParams(): unknown {
  return JSON.parse(String(screen.getByTestId('feed').props.children));
}

function createScreen(testID: string) {
  return function RouteScreen() {
    return <Text testID={testID}>{testID}</Text>;
  };
}

async function setup({
  status,
  systemUrl,
  url,
  preview = 'found',
  redeem = createRedeemResponseDto(),
  syncStorage = createMemorySyncStorage(),
}: SetupOptions) {
  const authSessionStore = createAuthSessionStoreStub(status);
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(
    respondByPath({
      'v1/auth/me': ok(createCurrentUserDto()),
      [`v1/invites/${INVITE_CODE}`]:
        preview === 'found' ? ok(createInvitePreviewDto()) : err(createInviteApiError()),
    }),
  );
  httpClient.post.mockImplementation(
    respondByPath({
      [`v1/invites/${INVITE_CODE}/redeem`]: redeem instanceof ApiError ? err(redeem) : ok(redeem),
    }),
  );
  const analytics = createAnalyticsStub();
  const di = createTestDi({
    ports: { httpClient, analytics, syncStorage },
    seeds: { authSessionStore },
  });

  function AuthScreen({ name }: { name: string }) {
    return (
      <>
        <Pressable accessibilityRole="button" onPress={() => authSessionStore.signIn()}>
          <Text>{`${name} 완료`}</Text>
        </Pressable>
        {/* 로그인·가입 화면의 "초대 코드가 있어요" */}
        <Pressable accessibilityRole="button" onPress={() => router.push('/invite')}>
          <Text>{`${name}에서 초대 코드`}</Text>
        </Pressable>
      </>
    );
  }

  const routes = {
    '+native-intent': NativeIntent,
    _layout: AuthGateLayout,
    index: RootIndex,
    loading: createScreen('loading'),
    'auth/[provider]': OAuthCallbackScreen,
    'invite/_layout': InviteLayout,
    'invite/index': InviteCodeEntryRoute,
    'invite/[inviteCode]': InviteCardScreen,
    '(auth)/_layout': () => <Stack screenOptions={{ animation: 'none' }} />,
    '(auth)/login': () => <AuthScreen name="로그인" />,
    '(auth)/sign-up': () => <AuthScreen name="가입" />,
    '(app)/_layout': {
      default: () => <Stack screenOptions={{ headerShown: false, animation: 'none' }} />,
      unstable_settings: { anchor: '(tabs)' },
    },
    // NativeTabs는 Jest에서 그려지지 않아 같은 탭 라우터를 쓰는 JS Tabs로 대신한다. NativeTabs처럼 처음부터 모든 탭을 띄운다
    '(app)/(tabs)/_layout': {
      default: () => (
        <Tabs screenOptions={{ headerShown: false, lazy: false }}>
          <Tabs.Screen name="(todos)" />
          <Tabs.Screen name="(memos)" />
          <Tabs.Screen name="(me)" />
        </Tabs>
      ),
      unstable_settings: tabsSettings,
    },
    '(app)/(tabs)/(todos)/_layout': {
      default: () => <Stack screenOptions={{ animation: 'none' }} />,
      unstable_settings: todosTabSettings,
    },
    '(app)/(tabs)/(memos)/_layout': {
      default: () => <Stack screenOptions={{ animation: 'none' }} />,
      unstable_settings: memosTabSettings,
    },
    '(app)/(tabs)/(me)/_layout': {
      default: () => <Stack screenOptions={{ animation: 'none' }} />,
      unstable_settings: meTabSettings,
    },
    '(app)/(tabs)/(todos)/feed/index': FeedScreen,
    '(app)/(tabs)/(memos)/memo/index': createScreen('memo'),
    '(app)/(tabs)/(me)/mypage/index': createScreen('mypage'),
    '(app)/(tabs)/(me,memos,todos)/friends/index': createScreen('friends'),
    '(app)/(tabs)/(me,memos,todos)/friends/invite/index': createScreen('my-invite'),
    '(app)/invite-welcome/[friendId]': () => <InviteWelcomeBottomSheet />,
    '(app)/todo/new': createScreen('todo-new'),
  };

  const initialUrl =
    systemUrl == null
      ? (url ?? '/')
      : NativeIntent.redirectSystemPath({ path: systemUrl, initial: true });
  // Metro는 route 파일을 경로 순으로 올리고, 탭이 정해지지 않은 링크가 고르는 그룹이 이 순서를 따른다. 같은 순서로 올린다
  const route = await renderAppRoute(
    Object.fromEntries(Object.entries(routes).sort(([a], [b]) => (a < b ? -1 : 1))),
    { url: initialUrl, di, withLocalDate: true },
  );

  return {
    route,
    syncStorage,
    screenViews: () => analytics.trackScreenView.mock.calls.map(([name]) => name),
    rootStack: () => describeStack(route.getRouterState()),
  };
}

interface StackNode {
  name: string;
  state?: { routes: StackNode[] };
}

/** 루트 Stack에 쌓인 route와 그 바로 안 route 이름. 끝난 카드나 탭 묶음이 두 번 쌓였는지 본다 */
function describeStack(rootState: unknown): string[] {
  const [root] = isStackState(rootState) ? rootState.routes : [];
  return (
    root?.state?.routes.map((node) =>
      node.state == null
        ? node.name
        : `${node.name}[${node.state.routes.map(({ name }) => name).join(',')}]`,
    ) ?? []
  );
}

function isStackState(value: unknown): value is { routes: StackNode[] } {
  return typeof value === 'object' && value != null && 'routes' in value;
}

async function openSystemUrl(url: string) {
  await act(async () => {
    systemUrlListeners.forEach((listener) => listener({ url }));
  });
}

describe('초대 링크로 들어온 흐름', () => {
  beforeEach(() => {
    stubWindowDimensions(390);
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
    jest.mocked(ExpoLinking.useLinkingURL).mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('로그인 전 링크로 가입하면 피드를 거치지 않고 할 일 탭 위에 카드를 다시 열고, 수락 뒤 뒤로 가도 카드로 돌아오지 않는다', async () => {
    // Given
    const { route, syncStorage, screenViews, rootStack } = await setup({
      status: 'unauthenticated',
      systemUrl: SHARED_INVITE_LINK,
    });
    await act(async () => fireEvent.press(await screen.findByTestId('invite-card-signup')));
    expect(route.getPathname()).toBe('/sign-up');

    // When
    await act(async () => fireEvent.press(screen.getByRole('button', { name: '가입 완료' })));

    // Then
    expect(await screen.findByTestId('invite-card-redeem')).toBeTruthy();
    expect(route.getPathname()).toBe(`/invite/${INVITE_CODE}`);
    expect(rootStack()).toEqual(['(app)[(tabs)]', 'invite[[inviteCode]]']);
    expect(screenViews()).not.toContain('/feed');
    expect(screenViews().at(-1)).toBe('/invite/[inviteCode]');
    expect(readStoredValue(syncStorage, pendingRedemptionStoredValue)).toBeNull();

    // When
    await act(async () => fireEvent.press(screen.getByTestId('invite-card-redeem')));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe(`/invite-welcome/${INVITER_ID}`));
    expect(rootStack()).toEqual(['(app)[(tabs),invite-welcome/[friendId]]']);

    // When
    await act(async () => fireEvent.press(screen.getByTestId('invite-welcome-open-friend-feed')));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
    expect(route.getSearchParams()).toEqual({ friendId: INVITER_ID });
    expect(rootStack()).toEqual(['(app)[(tabs)]']);
    expect(router.canGoBack()).toBe(false);
  });

  it('로그인 화면에서 초대 코드를 넣어 연 카드로 로그인하면 코드 입력·로그인 전 카드가 남지 않는다', async () => {
    // Given
    const { route, rootStack } = await setup({ status: 'unauthenticated', url: '/login' });
    await act(async () =>
      fireEvent.press(screen.getByRole('button', { name: '로그인에서 초대 코드' })),
    );
    expect(route.getPathname()).toBe('/invite');
    await act(async () => fireEvent.changeText(screen.getByLabelText('초대 코드'), INVITE_CODE));
    await act(async () => fireEvent.press(screen.getByTestId('invite-code-submit')));
    await waitFor(() => expect(route.getPathname()).toBe(`/invite/${INVITE_CODE}`));
    expect(rootStack()).toEqual(['(auth)[login]', 'invite[[inviteCode]]']);

    // When
    await act(async () => fireEvent.press(await screen.findByTestId('invite-card-login')));
    await act(async () => fireEvent.press(screen.getByRole('button', { name: '로그인 완료' })));

    // Then
    expect(await screen.findByTestId('invite-card-redeem')).toBeTruthy();
    expect(rootStack()).toEqual(['(app)[(tabs)]', 'invite[[inviteCode]]']);
  });

  it('로그인 전 링크로 Android 소셜 로그인을 하면 콜백 화면을 닫고 로그인을 마친 뒤 피드를 거치지 않고 카드를 연다', async () => {
    // Given
    const { route, screenViews, rootStack } = await setup({
      status: 'unauthenticated',
      systemUrl: SHARED_INVITE_LINK,
    });
    await act(async () => fireEvent.press(await screen.findByTestId('invite-card-login')));
    await openSystemUrl(`${ENV.SCHEME}://auth/kakao?code=one-time-code`);
    expect(route.getPathname()).toBe('/login');

    // When
    await act(async () => fireEvent.press(screen.getByRole('button', { name: '로그인 완료' })));

    // Then
    expect(await screen.findByTestId('invite-card-redeem')).toBeTruthy();
    expect(rootStack()).toEqual(['(app)[(tabs)]', 'invite[[inviteCode]]']);
    expect(screenViews()).not.toContain('/feed');
  });

  it('로그인한 채 꺼진 앱을 링크로 열고 수락하면 환영 시트 아래에 할 일 탭이 깔리고 닫으면 피드다', async () => {
    // Given
    const { route, rootStack } = await setup({
      status: 'authenticated',
      systemUrl: SHARED_INVITE_LINK,
    });

    // When
    await act(async () => fireEvent.press(await screen.findByTestId('invite-card-redeem')));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe(`/invite-welcome/${INVITER_ID}`));
    expect(rootStack()).toEqual(['(app)[(tabs),invite-welcome/[friendId]]']);

    // When
    await act(() => router.back());

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
    expect(rootStack()).toEqual(['(app)[(tabs)]']);
    expect(router.canGoBack()).toBe(false);
  });

  it('켜 둔 앱(친구 목록)에 링크가 들어와 수락하면 카드를 닫고 보던 탭 위에 환영 시트를 띄우고, 닫으면 보던 화면이다', async () => {
    // Given
    const { route, rootStack } = await setup({ status: 'authenticated', url: '/friends' });
    await openSystemUrl(SHARED_INVITE_LINK);
    expect(route.getPathname()).toBe(`/invite/${INVITE_CODE}`);

    // When
    await act(async () => fireEvent.press(await screen.findByTestId('invite-card-redeem')));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe(`/invite-welcome/${INVITER_ID}`));
    expect(rootStack()).toEqual(['(app)[(tabs),invite-welcome/[friendId]]']);

    // When
    await act(() => router.back());

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/friends'));
  });

  it.each([
    [
      '이미 친구',
      createRedeemResponseDto({ outcome: 'ALREADY_FRIENDS' }),
      '/feed',
      { friendId: INVITER_ID },
      '(todos)',
    ],
    [
      '내 코드',
      createInviteApiError({ code: 'INVITE_2103', status: 400 }),
      '/friends/invite',
      {},
      '(me)',
    ],
  ] as const)(
    '%s 결과는 카드를 닫고 그 화면을 가진 탭에 첫 화면을 깔고 연다',
    async (_name, redeem, pathname, params, tab) => {
      // Given
      const { route, rootStack } = await setup({
        status: 'authenticated',
        systemUrl: SHARED_INVITE_LINK,
        redeem,
      });

      // When
      await act(async () => fireEvent.press(await screen.findByTestId('invite-card-redeem')));

      // Then
      await waitFor(() => expect(route.getPathname()).toBe(pathname));
      expect(route.getSearchParams()).toEqual(params);
      expect(route.getSegments()[2]).toBe(tab);
      expect(rootStack()).toHaveLength(1);
      expect(rootStack()[0]).toMatch(/^\(app\)\[\(tabs\)/);
    },
  );

  it('없는 코드면 찾을 수 없다고 알리고, 코드 입력으로 가면 카드를 바꿔 끼워 뒤로 가도 그 카드가 없다', async () => {
    // Given
    const { route, rootStack } = await setup({
      status: 'authenticated',
      systemUrl: SHARED_INVITE_LINK,
      preview: 'not-found',
    });
    expect(await screen.findByTestId('invite-result-not-found')).toBeTruthy();

    // When
    await act(async () => fireEvent.press(screen.getByTestId('invite-result-enter-code')));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/invite'));
    expect(rootStack()).toEqual(['invite[index]']);
  });
});

/** 켜 둔 앱에서 보던 곳(탭 첫 화면, 그 탭, 위에 띄운 탭 밖 시트 route) */
const WARM_STARTS = [
  ['/feed', '(todos)', null],
  ['/feed', '(todos)', '/todo/new'],
  ['/memo', '(memos)', null],
  ['/memo', '(memos)', '/todo/new'],
  ['/mypage', '(me)', null],
  ['/mypage', '(me)', '/todo/new'],
] as const;

/** 카드 아래 띄워 둔 시트가 있으면 닫는다 */
async function closeSheet(sheetUrl: string | null) {
  if (sheetUrl != null) {
    await act(() => router.back());
  }
}

describe('켜 둔 앱에 들어온 초대 링크', () => {
  beforeEach(() => {
    stubWindowDimensions(390);
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
    jest.mocked(ExpoLinking.useLinkingURL).mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(WARM_STARTS)(
    '%s 탭(%s, 시트 %s)에서 연 내 코드 카드를 수락하면 그 탭에 내 초대를 열고 뒤로 가면 탭 첫 화면이다',
    async (startUrl, tab, sheetUrl) => {
      // Given
      const { route, rootStack } = await setup({
        status: 'authenticated',
        url: startUrl,
        redeem: createInviteApiError({ code: 'INVITE_2103', status: 400 }),
      });
      if (sheetUrl != null) {
        await act(() => router.push(sheetUrl));
      }
      await openSystemUrl(`${ENV.SCHEME}://invite/${INVITE_CODE}`);

      // When
      await act(async () => fireEvent.press(await screen.findByTestId('invite-card-redeem')));

      // Then
      await waitFor(() => expect(route.getPathname()).toBe('/friends/invite'));
      expect(route.getSegments()[2]).toBe(tab);
      expect(rootStack()).toHaveLength(1);

      // When
      await act(() => router.back());

      // Then
      expect(route.getPathname()).toBe(startUrl);
      expect(route.getSegments()[2]).toBe(tab);
    },
  );

  it.each(WARM_STARTS)(
    '%s 탭(%s, 시트 %s)에서 연 초대 카드는 그 위에 뜨고 닫으면 보던 화면이다',
    async (startUrl, tab, sheetUrl) => {
      // Given
      const { route } = await setup({ status: 'authenticated', url: startUrl });
      if (sheetUrl != null) {
        await act(() => router.push(sheetUrl));
      }

      // When
      await openSystemUrl(`${ENV.SCHEME}://invite/${INVITE_CODE}`);

      // Then
      expect(await screen.findByTestId('invite-card-redeem')).toBeTruthy();
      expect(route.getPathname()).toBe(`/invite/${INVITE_CODE}`);

      // When
      await act(() => router.back());

      // Then
      expect(route.getPathname()).toBe(sheetUrl ?? startUrl);

      // When
      await closeSheet(sheetUrl);

      // Then
      expect(route.getPathname()).toBe(startUrl);
      expect(route.getSegments()[2]).toBe(tab);
    },
  );

  it.each(WARM_STARTS)(
    '%s 탭(%s, 시트 %s)에서 연 없는 코드 카드는 찾을 수 없다고 알리고 닫으면 보던 화면이다',
    async (startUrl, tab, sheetUrl) => {
      // Given
      const { route } = await setup({
        status: 'authenticated',
        url: startUrl,
        preview: 'not-found',
      });
      if (sheetUrl != null) {
        await act(() => router.push(sheetUrl));
      }

      // When
      await openSystemUrl(`${ENV.SCHEME}://invite/${INVITE_CODE}`);

      // Then
      expect(await screen.findByTestId('invite-result-not-found')).toBeTruthy();

      // When
      await act(() => router.back());

      // Then
      expect(route.getPathname()).toBe(sheetUrl ?? startUrl);

      // When
      await closeSheet(sheetUrl);

      // Then
      expect(route.getPathname()).toBe(startUrl);
      expect(route.getSegments()[2]).toBe(tab);
    },
  );
});

type WelcomeExit = 'createFirstTodo' | 'openFriendFeed' | 'dismiss';

/** 환영 시트에서 떠나는 길(시트를 연 곳, 누른 것, 도착 경로와 피드 params, 뒤로 가면 나올 경로). 탭 묶음은 늘 하나다 */
const WELCOME_EXITS: ReadonlyArray<
  readonly [string, WelcomeExit, string, Record<string, string> | null, string | null]
> = [
  [SHARED_INVITE_LINK, 'createFirstTodo', '/feed', { action: 'add-todo' }, null],
  [SHARED_INVITE_LINK, 'openFriendFeed', '/feed', { friendId: INVITER_ID }, null],
  [SHARED_INVITE_LINK, 'dismiss', '/feed', {}, null],
  ['/friends', 'createFirstTodo', '/feed', { action: 'add-todo' }, null],
  ['/friends', 'openFriendFeed', '/feed', { friendId: INVITER_ID }, null],
  ['/friends', 'dismiss', '/friends', null, '/mypage'],
];

/** 뒤로 가기 한 번 뒤의 경로. 돌아갈 곳이 없으면 null이다 */
async function goBack(route: { getPathname(): string }): Promise<string | null> {
  if (!router.canGoBack()) {
    return null;
  }
  await act(() => router.back());
  return route.getPathname();
}

async function leaveWelcome(exit: WelcomeExit) {
  if (exit === 'dismiss') {
    await act(() => router.back());
    return;
  }
  const label = exit === 'createFirstTodo' ? '첫 할 일 만들기' : '민지님 할 일 먼저 보기';
  await act(async () => fireEvent.press(screen.getByRole('button', { name: label })));
}

describe('초대 환영 시트에서 떠나는 길', () => {
  beforeEach(() => {
    stubWindowDimensions(390);
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
    jest.mocked(ExpoLinking.useLinkingURL).mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(WELCOME_EXITS)(
    '%s에서 연 카드를 수락한 뒤 %s를 누르면 %s에 열고 탭 묶음은 하나다',
    async (openedFrom, exit, pathname, params, backPathname) => {
      // Given
      const { route, rootStack } = await setup(
        openedFrom === SHARED_INVITE_LINK
          ? { status: 'authenticated', systemUrl: SHARED_INVITE_LINK }
          : { status: 'authenticated', url: openedFrom },
      );
      if (openedFrom !== SHARED_INVITE_LINK) {
        await openSystemUrl(SHARED_INVITE_LINK);
      }
      await act(async () => fireEvent.press(await screen.findByTestId('invite-card-redeem')));
      await waitFor(() => expect(route.getPathname()).toBe(`/invite-welcome/${INVITER_ID}`));

      // When
      await leaveWelcome(exit);

      // Then
      await waitFor(() => expect(route.getPathname()).toBe(pathname));
      expect(params == null ? null : feedParams()).toEqual(params);
      expect(rootStack()).toEqual(['(app)[(tabs)]']);
      expect(await goBack(route)).toBe(backPathname);
    },
  );
});

/** 1.15.1까지 퍼진 초대 링크. 외부 계약이라 줄을 지우거나 바꾸지 않는다 */
const RELEASED_INVITE_LINKS: ReadonlyArray<readonly [string, string]> = [
  [SHARED_INVITE_LINK, `/invite/${INVITE_CODE}`],
  [`https://aido.kr/i/${INVITE_CODE.toLowerCase()}/?utm_source=kakao`, `/invite/${INVITE_CODE}`],
  [`/i/${INVITE_CODE}`, `/invite/${INVITE_CODE}`],
  [`${ENV.SCHEME}://invite/${INVITE_CODE}`, `/invite/${INVITE_CODE}`],
  ...(ENV.KAKAO_SCHEME == null
    ? []
    : [
        [
          `${ENV.KAKAO_SCHEME}://kakaolink?inviteCode=${INVITE_CODE}`,
          `/invite/${INVITE_CODE}`,
        ] as const,
      ]),
  [`${ENV.SCHEME}://invite`, '/invite'],
  ['https://aido.kr/i/K7M2Q0', '/invite'],
];

/** 출시 앱이 쓰는 이어서 열 초대 저장 key. 기기 저장 계약이다 */
const PENDING_REDEMPTION_KEY = 'aido_invite_pending_v1';

/** 출시 앱이 기기에 남긴 이어서 열 초대 원문 */
function releasedPendingRaw(source: string, savedDaysAgo: number) {
  const savedAt = new Date(Date.now() - savedDaysAgo * DAY_MS).toISOString();
  return `{"inviteCode":"${INVITE_CODE}","source":"${source}","savedAt":"${savedAt}"}`;
}

describe('출시 앱이 남긴 초대 링크·저장 값', () => {
  beforeEach(() => {
    stubWindowDimensions(390);
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
    jest.mocked(ExpoLinking.useLinkingURL).mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(RELEASED_INVITE_LINKS)('%s로 꺼진 앱을 열면 %s에 착지한다', async (link, pathname) => {
    // When
    const { route } = await setup({ status: 'unauthenticated', systemUrl: link });

    // Then
    expect(route.getPathname()).toBe(pathname);
  });

  it.each(['universal_link', 'app_scheme', 'kakao', 'install_referrer', 'code_entry'])(
    '기한 안에 %s로 남긴 초대는 로그인한 첫 화면이 할 일 탭 위에 한 번 열고 지운다',
    async (source) => {
      // Given
      const syncStorage = createMemorySyncStorage();
      syncStorage.set(PENDING_REDEMPTION_KEY, releasedPendingRaw(source, 1));

      // When
      const { route, rootStack } = await setup({ status: 'authenticated', syncStorage });

      // Then
      await waitFor(() => expect(route.getPathname()).toBe(`/invite/${INVITE_CODE}`));
      expect(route.getSearchParams()).toEqual({ inviteCode: INVITE_CODE, source });
      expect(rootStack()).toEqual(['(app)[(tabs)]', 'invite[[inviteCode]]']);
      expect(readStoredValue(syncStorage, pendingRedemptionStoredValue)).toBeNull();
    },
  );

  it('기한이 지난 초대는 열지 않고 지워 첫 화면이 피드다', async () => {
    // Given
    const syncStorage = createMemorySyncStorage();
    syncStorage.set(
      PENDING_REDEMPTION_KEY,
      releasedPendingRaw('universal_link', INVITE_REDEEM_WINDOW_DAYS + 1),
    );

    // When
    const { route, rootStack } = await setup({ status: 'authenticated', syncStorage });

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
    expect(rootStack()).toEqual(['(app)[(tabs)]']);
    expect(readStoredValue(syncStorage, pendingRedemptionStoredValue)).toBeNull();
  });
});
