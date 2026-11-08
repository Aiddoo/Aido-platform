# Illustration

빈 목록·처음 화면·오류에 쓰는 그림이에요. 메모 빈 목록의 영수증 그림을 기준으로 같은 짜임으로 그렸어요.

- 몸통: 밝은 회색 `#EFEFEF` 하나. 라이트·다크에서 같은 색이라 다크 화면에서도 그림이 또렷하게 떠요
- 포인트: 오른쪽 위 덮개(또는 원 배지)와 안쪽 3px 둥근 줄. `currentColor`라 `main` 토큰을 따라요
- 테두리 선은 쓰지 않아요. 72×72 그리드, 9px 안쪽 여백

```tsx
<Result
  icon={<MemoIllustration />}
  title={t('memo:list.emptyTitle')}
  description={t('memo:list.emptyDescription')}
/>

// 점선 카드 같은 블록 안
<Result icon={<FriendIllustration size="block" />} title={t('invite:friendList.emptyTitle')} />
```

| 그림                       | 쓰는 곳                                                        |
| -------------------------- | -------------------------------------------------------------- |
| `MemoIllustration`         | 메모 목록, 선택한 메모 없음, 말로 남긴 메모 없음, 찾을 수 없음 |
| `TodoIllustration`         | 친구 할 일, 선택한 할 일 없음, 볼 수 없는 할 일, AI 제안 없음  |
| `NotificationIllustration` | 알림 목록, 보낸 콕, 고마움 전할 친구 없음                      |
| `FriendIllustration`       | 친구 목록, 받은·보낸 요청, 초대한 친구, 차단한 사용자          |
| `SearchIllustration`       | 친구 찾기 처음 화면, 검색 결과 없음, 초대 코드 없음            |
| `CommentIllustration`      | 할 일 댓글 목록                                                |
| `OfflineIllustration`      | 연결 없이 연 화면                                              |
| `ErrorIllustration`        | 조회 오류(`QueryErrorFallback`, `.Error`)                      |

| Props  | 타입                  | 기본       | 설명                |
| ------ | --------------------- | ---------- | ------------------- |
| `size` | `'screen' \| 'block'` | `'screen'` | 화면 72, 블록 안 56 |

원본 SVG는 `assets/illustrations/il_{name}.svg`예요. 새 그림도 몸통 `#EFEFEF` + `currentColor` 두 색만 써요.
