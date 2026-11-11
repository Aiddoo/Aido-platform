import { unwrap } from '@src/core/errors/result';
import { createHttpClientStub } from '@src/testing/core';

import {
  createReorderFriendDto,
  createSearchUsersDto,
  createSendFriendRequestDto,
} from '../__tests__/friend.fixtures';
import { FRIEND_ERROR_CODE } from '../domains/friend.error';
import { FriendService } from './friend.service';

describe('FriendService', () => {
  let httpClient: ReturnType<typeof createHttpClientStub>;
  let service: FriendService;

  beforeEach(() => {
    httpClient = createHttpClientStub();
    service = new FriendService(httpClient);
  });

  describe('sendRequestByTag', () => {
    it('태그가 비어 있으면 EMPTY_TAG 오류를 반환한다', async () => {
      // When
      const result = await service.sendRequestByTag('  ');

      // Then
      expect(result).toEqual({ ok: false, error: expect.any(Error) });
      expect(result).toMatchObject({ error: { code: FRIEND_ERROR_CODE.EMPTY_TAG } });
      expect(httpClient.post).not.toHaveBeenCalled();
    });

    it('태그 형식이 틀리면 INVALID_TAG 오류를 반환한다', async () => {
      // When
      const result = await service.sendRequestByTag('abc');

      // Then
      expect(result).toEqual({ ok: false, error: expect.any(Error) });
      expect(result).toMatchObject({ error: { code: FRIEND_ERROR_CODE.INVALID_TAG } });
      expect(httpClient.post).not.toHaveBeenCalled();
    });

    it('태그가 맞으면 요청 결과를 반환한다', async () => {
      // Given
      const dto = createSendFriendRequestDto();
      httpClient.post.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.sendRequestByTag('ABCD1234');

      // Then
      expect(httpClient.post).toHaveBeenCalledWith('v1/follows/ABCD1234');
      expect(result).toEqual({
        ok: true,
        value: { autoAccepted: dto.autoAccepted },
      });
    });
  });

  describe('reorderFriend', () => {
    it('응답을 받으면 순서를 바꾼 친구를 반환한다', async () => {
      // Given
      const dto = createReorderFriendDto();
      httpClient.patch.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.reorderFriend('follow-1', {
        targetFollowId: 'follow-2',
        position: 'after',
      });

      // Then
      expect(httpClient.patch).toHaveBeenCalledWith('v1/follows/friends/follow-1/reorder', {
        targetFollowId: 'follow-2',
        position: 'after',
      });
      expect(result).toMatchObject({
        ok: true,
        value: {
          followId: dto.friend.followId,
          friendsSince: expect.stringMatching(/^2026-/),
        },
      });
    });
  });

  describe('searchUsers', () => {
    it('검색어가 2자 미만이면 요청 없이 오류를 반환한다', async () => {
      // When
      const result = await service.searchUsers({ query: ' a ' });

      // Then
      expect(result).toEqual({ ok: false, error: expect.any(Error) });
      expect(result).toMatchObject({ error: { code: FRIEND_ERROR_CODE.SEARCH_QUERY_TOO_SHORT } });
      expect(httpClient.get).not.toHaveBeenCalled();
    });

    it('검색어의 앞뒤 공백을 지우고 조회해 페이지를 반환한다', async () => {
      // Given
      const dto = createSearchUsersDto();
      httpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.searchUsers({ query: '  홍길동  ', cursor: 'c1', limit: 20 });

      // Then
      expect(httpClient.get).toHaveBeenCalledWith('v1/follows/search', {
        params: { q: '홍길동', cursor: 'c1', limit: 20 },
      });
      expect(result.ok).toBe(true);
      const page = unwrap(result);
      expect(page.items).toHaveLength(4);
      expect(page.nextCursor).toBeNull();
      // 동명이인 2명이 태그로 구분됨
      const hongs = page.items.filter((u) => u.name === '홍길동');
      expect(hongs).toHaveLength(2);
      expect(new Set(hongs.map((u) => u.userTag)).size).toBe(2);
    });
  });
});
