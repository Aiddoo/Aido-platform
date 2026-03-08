import type {
  AcceptFriendRequestResponse,
  FriendsListResponse,
  ReceivedRequestsResponse,
  SendFriendRequestResponse,
  SentRequestsResponse,
} from '@aido/validators';
import { ApiError } from '@src/shared/errors/api-error';

const generateSendFriendRequestDto = (): SendFriendRequestResponse => ({
  message: '친구 요청을 보냈어요.',
  follow: {
    id: 'clz7x5p8k0010qz0z8z8z8z8z',
    followerId: 'clz7x5p8k0001qz0z8z8z8z8z',
    followingId: 'clz7x5p8k0005qz0z8z8z8z8z',
    status: 'PENDING',
    createdAt: '2026-01-17T15:00:00.000Z',
    updatedAt: '2026-01-17T15:00:00.000Z',
  },
  autoAccepted: false,
});

export const createSendFriendRequestDto = (
  overrides?: Partial<SendFriendRequestResponse>,
): SendFriendRequestResponse => ({
  ...generateSendFriendRequestDto(),
  ...overrides,
});

const generateAcceptFriendRequestDto = (): AcceptFriendRequestResponse => ({
  message: '친구 요청을 수락했어요.',
  friend: {
    followId: 'clz7x5p8k0010qz0z8z8z8z8z',
    id: 'clz7x5p8k0005qz0z8z8z8z8z',
    userTag: 'JOHN2026',
    name: '존',
    profileImage: 'https://example.com/profiles/john.jpg',
    friendsSince: '2026-01-17T15:30:00.000Z',
  },
});

export const createAcceptFriendRequestDto = (
  overrides?: Partial<AcceptFriendRequestResponse>,
): AcceptFriendRequestResponse => ({
  ...generateAcceptFriendRequestDto(),
  ...overrides,
});

const generateFriendsListDto = (): FriendsListResponse => ({
  friends: [
    {
      id: 'clz7x5p8k0005qz0z8z8z8z8z',
      userTag: 'ABCD1234',
      name: '홍길동',
      profileImage: 'https://example.com/avatar1.jpg',
      followId: 'clz7x5p8k0010qz0z8z8z8z8z',
      friendsSince: '2026-01-15T00:00:00.000Z',
    },
    {
      id: 'clz7x5p8k0007qz0z8z8z8z8z',
      userTag: 'EFGH5678',
      name: null,
      profileImage: null,
      followId: 'clz7x5p8k0011qz0z8z8z8z8z',
      friendsSince: '2026-02-20T00:00:00.000Z',
    },
  ],
  totalCount: 2,
  hasMore: false,
});

export const createFriendsListDto = (
  overrides?: Partial<FriendsListResponse>,
): FriendsListResponse => ({
  ...generateFriendsListDto(),
  ...overrides,
});

const generateReceivedRequestsDto = (): ReceivedRequestsResponse => ({
  requests: [
    {
      id: 'clz7x5p8k0008qz0z8z8z8z8z',
      userTag: 'IJKL9012',
      name: '김철수',
      profileImage: 'https://example.com/avatar3.jpg',
      requestedAt: '2026-03-01T10:00:00.000Z',
    },
  ],
  totalCount: 1,
  hasMore: false,
});

export const createReceivedRequestsDto = (
  overrides?: Partial<ReceivedRequestsResponse>,
): ReceivedRequestsResponse => ({
  ...generateReceivedRequestsDto(),
  ...overrides,
});

const generateSentRequestsDto = (): SentRequestsResponse => ({
  requests: [
    {
      id: 'clz7x5p8k0009qz0z8z8z8z8z',
      userTag: 'MNOP3456',
      name: '이영희',
      profileImage: null,
      requestedAt: '2026-03-02T14:00:00.000Z',
    },
  ],
  totalCount: 1,
  hasMore: false,
});

export const createSentRequestsDto = (
  overrides?: Partial<SentRequestsResponse>,
): SentRequestsResponse => ({
  ...generateSentRequestsDto(),
  ...overrides,
});

export const createFriendApiError = (
  overrides?: Partial<{ code: string; message: string; status: number }>,
) =>
  new ApiError(
    overrides?.code ?? 'FOLLOW_0901',
    overrides?.message ?? '자기 자신에게 친구 요청을 보낼 수 없어요',
    overrides?.status ?? 400,
  );

export const INVALID_DTO = { invalid: 'data' };
