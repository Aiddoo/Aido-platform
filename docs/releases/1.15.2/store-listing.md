# 1.15.2 스토어 업데이트 내용

App Store와 Google Play에 넣은 글이 다르다.

- **Play 출시 노트**와 저장소 파일(`listing/*/release_notes.txt` 네 개, [release.json](../../../apps/mobile/store-metadata/1.15.2/release.json)의 `patchNotes`)은 랜딩 패치노트(`aido-landing` `src/features/updates/data/patch-notes.ts`, `docs/patch-notes-1.15.2`를 PR #66으로 `main`에 합친 판)의 1.15.2 `summary`와 `storeNotes`를 그대로 쓴다. 랜딩의 `formatStoreNotes`(요약 한 줄 + 빈 줄 + `- ` 항목)가 만드는 글과 같다. 1.15.1과 같은 방식이다.
- **App Store "이 버전에서 업그레이드된 사항"**에는 ASC에 새 기능·개선·버그 수정 19줄(절 제목 3, 항목 14)을 넣었다(2026-11-13). Android 내용은 없고 en-US·en-GB가 같다.
- **다른 이유**: Play는 500자 한도라 10줄 요약만 들어가고, App Store는 4000자까지라 사용자가 알아볼 변경을 절로 나눠 더 적었다. `store:check`는 두 스토어의 `release_notes.txt`를 같은 글로 비교하고 항목을 `release.json`과 맞추므로, 저장소의 App Store 파일도 Play와 같은 10줄로 둔다. App Store에 실제로 넣은 글은 이 문서가 원본이다(스토어별 출시 노트 검사는 [다음 버전 후보](README.md#다음-버전-후보)).

글자 수는 `store-listing.mjs`의 `characterCount`(유니코드 글자)로 셌다.

## Play 출시 노트(저장소 파일과 같음)

한국어(Play `ko-KR`, 저장소 App Store `ko`, 454/500자):

```text
쓰던 글은 앱을 다시 열어도 그대로 남고, 알림이나 다른 탭에서 연 화면도 뒤로 가면 보던 곳으로 돌아와요. 오래 쉬었다 열어도 화면이 로딩에서 멈추지 않아요.

- 할 일에 쓰던 댓글이 앱을 다시 열어도 그대로 있어요.
- 메모나 할 일을 고치는 동안 쓰던 글이 사라지지 않고, 저장을 다시 눌러도 메모는 하나만 생겨요.
- 다른 탭이나 알림에서 연 화면도 뒤로 가면 보던 곳으로 돌아와요.
- 알림함이 지금 보던 탭 안에서 열려요.
- 초대 링크로 가입하거나 로그인하면 바로 초대로 이어져요.
- 오래 쉬었다 열어도 화면이 로딩에서 멈추지 않아요.
- 달력과 위젯, 리포트의 주차를 같은 기준으로 보여 드려요.
- iPhone에서 메모 카드를 길게 누르면 바로 고정하거나 지울 수 있어요.
- 글꼴 크기를 키우면 아이콘도 함께 커져요.
- 계정을 바꾼 직후 결제가 이전 계정에 잡힐 수 있던 문제를 고쳤어요.
```

영어(Play `en-US`, 저장소 App Store `en-US`, 488/500자):

```text
Drafts stay, and back goes where you expect.

- Comment drafts come back after reopening.
- Edits stay safe, and notes aren't saved twice.
- Back returns you to where you were.
- Notifications open in the tab you're on.
- Invite links go straight to the invite.
- No more endless loading after a break.
- Calendar, widgets, and reports count weeks alike.
- On iPhone, long-press a note to pin or delete it.
- Icons scale with your font size.
- Fixed purchases going to a previous account.
```

## Play 문장마다 근거

| 줄   | 근거 PR(출시 기록의 해당 절)                                                                  |
| ---- | --------------------------------------------------------------------------------------------- |
| 요약 | 댓글 초안 [32.44/32], 수정 폼 [32.19/32]·[32.27/32], 탭 이동 [32.45/32], 요청 멈춤 [32.44/32] |
| 1    | 댓글 초안 복원 [32.44/32] (기기 QA에서 찾은 결함)                                             |
| 2    | 수정 폼 [32.19/32]·[32.27/32], 메모 `Idempotency-Key` [22/32] (데이터 안전)                   |
| 3    | 탭 공유 경로·`openEntryHref`·알림함 [32.45/32] (탭 이동)                                      |
| 4    | 알림함을 탭 안 공유 화면으로 [32.45/32] (탭 이동, 의도한 화면 차이)                           |
| 5    | 초대 진입 [32.45/32] (탭 이동)                                                                |
| 6    | 토큰 갱신 멈춤·200 본문 시간 제한 [32.44/32] (기기 QA에서 찾은 결함)                          |
| 7    | 주차 [32.07/32] (의도한 화면 차이 > 주차). 화면 글자가 바뀌므로 알린다                        |
| 8    | 메모 카드 길게 누르기 [32.20/32] (메모·AI). iOS에만 있는 동작이다                             |
| 9    | 아이콘 글꼴 배율 [32.29/32]·[32.33/32]·[32.26/32] (접근성)                                    |
| 10   | 결제 귀속 [32.31/32] (데이터 안전)                                                            |

PR 제목은 [출시 기록의 PR 목록](README.md#pr-목록)에 있다.

## App Store에 넣은 글(ASC)

한국어(`ko`, 810/4000자):

```text
새로운 기능
- iPhone에서 메모 카드나 말로 남긴 메모를 길게 눌러 보세요. 열지 않고도 미리 보고, 바로 고정하거나 지울 수 있어요.
- 친구 피드에서 친구의 할 일을 누르면 자세히 볼 수 있고, 마이 > 친구 관리에서 친구를 누르면 그 친구의 피드로 바로 가요.

개선
- 메모나 할 일을 고치는 동안 쓰던 글을 그대로 지켜 드려요.
- 다른 탭이나 알림, 링크에서 연 화면도 뒤로 가면 보던 탭으로 자연스럽게 돌아와요. 알림함도 지금 보던 탭 안에서 열려요.
- 초대 링크로 가입하거나 로그인하면 바로 초대로 이어져요.
- 달력·위젯·주간 성취·AI 리포트가 같은 기준으로 주차를 세요. 달이 바뀌는 주는 이름이 조금 달라질 수 있어요.
- 문제가 생기면 원인에 맞게 안내하고, 비밀번호나 초대 코드를 잘못 넣으면 무엇을 고치면 되는지 바로 알려 드려요.
- iPad에서 창 크기를 바꾸거나 iPhone Duo를 접고 펴도 목록과 달력이 알맞게 보이고, 글꼴 크기를 키우면 아이콘도 함께 커져요.

버그 수정
- 할 일에 쓰던 댓글이 앱을 다시 열면 사라지던 문제를 고쳤어요.
- 저장을 빠르게 두 번 누르면 할 일·메모·카테고리가 두 개씩 생기던 문제를 고쳤어요.
- 오래 쉬었다 열거나 연결이 잠깐 불안정할 때 할 일 화면이 로딩에서 멈추던 문제를 고쳤어요.
- 계정을 바꾼 직후 결제하면 구독이 이전 계정에 잡힐 수 있던 문제를 고쳤어요.
- 할 일을 추가할 때 '말로 해도 돼요' 안내가 날짜·시간 버튼을 가리던 문제를 고쳤어요.
- 그 밖에 콕·신고가 두 번 보내지거나 댓글 정렬을 바꿀 때 목록이 깜박이던 문제 등을 고쳤어요.
```

영어(`en-US`·`en-GB` 같음, 1,536/4000자):

```text
New features
- On iPhone, long-press a note card or voice note to peek at it, then pin or delete it without opening it.
- Tap a friend's to-do in their feed to see the details, or tap a friend in Me > Manage friends to jump to their feed.

Improvements
- Whatever you're typing in a note or to-do now stays just as you left it.
- Going back from a screen opened from another tab, a notification, or a link returns you to the tab you were on. Notifications also open right inside your current tab.
- Signing up or logging in from an invite link takes you straight to your invite.
- The calendar, widget, weekly achievements, and AI reports now count weeks the same way. Weeks that span two months may get a slightly different name.
- When something goes wrong, we'll tell you why, and if a password or invite code needs fixing, we'll show you what to change.
- On iPad and iPhone Duo, lists and the calendar fit nicely when you resize the window or fold and unfold, and icons now grow with your font size.

Bug fixes
- Fixed comment drafts disappearing after reopening the app.
- Fixed tapping Save twice quickly creating two to-dos, notes, or categories.
- Fixed to-do screens getting stuck loading after a long break or a brief connection hiccup.
- Fixed a purchase made right after switching accounts possibly going to the previous account.
- Fixed the Speak to add tip covering the date and time buttons when adding a to-do.
- Also fixed nudges or reports sending twice and the comment list flickering when you change the sort order.
```

| 줄            | 근거 PR(출시 기록의 해당 절)                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| 새 기능 1     | 메모 카드·말로 남긴 메모 길게 누르기 [32.20/32]·[32.22/32]                                            |
| 새 기능 2     | 친구 피드 할 일 상세 [32.20/32]·[32.27/32], 친구 목록에서 친구 피드로 [32.17/32]                      |
| 개선 1        | 수정 폼 [32.19/32]·[32.27/32], 메모 `Idempotency-Key` [22/32]                                         |
| 개선 2        | 탭 이동·알림함 [32.45/32]                                                                             |
| 개선 3        | 초대 진입 [32.45/32]                                                                                  |
| 개선 4        | 주차 [32.07/32]                                                                                       |
| 개선 5        | 오류 안내 [32.14/32]·[32.15/32], 비밀번호 안내 [32.44/32], 초대 코드 칸(의도한 화면 차이 > 화면·동작) |
| 개선 6        | iPad·Duo 칸 배치 [32.08/32], 달력 창 폭 [32.44/32], 아이콘 글꼴 배율 [32.29/32]·[32.33/32]            |
| 버그 수정 1–3 | 댓글 초안, 두 번 저장, 로딩 멈춤(렌더 반복·토큰 갱신) [32.44/32]                                      |
| 버그 수정 4   | 결제 귀속 [32.31/32]                                                                                  |
| 버그 수정 5   | 안내 말풍선이 덮은 칩 [32.44/32]                                                                      |
| 버그 수정 6   | 콕·신고 연타 [32.18/32]·[32.31/32]·[32.44/32], 댓글 정렬 깜박임 [32.44/32]                            |

## 쓰지 않은 것

- 구조 정리·리팩터링·린트·오류 처리 층 같은 내부 작업.
- 탈퇴 뒤 기기 기록 정리, 서버 오류 코드처럼 사용자가 화면에서 알아보기 어려운 변경. [출시 기록](README.md)에만 둔다.
- Play 8번 줄은 iOS 동작이라 "iPhone에서"를 붙였다(랜딩 문구 그대로). Play 금지어는 "iPhone Duo"뿐이라 검사는 통과한다.
- Play 글에는 절 제목을 두지 않는다. 랜딩과 같은 요약 한 줄 + 10줄이다. App Store 글은 새 기능·개선·버그 수정 절로 나눴다.

## 검사

- `pnpm --filter @aido/mobile store:check` 통과(저장소 파일 기준). App Store 글은 검사 밖이라 같은 규칙을 손으로 봤다.
- 브랜드: 한국어에 "Aido"가 없고 영어에 한글이 없다. "Pro"가 없다.
- 금지어: App Store 글에 "Google Play·갤럭시·Galaxy", Play 글에 "App Store·Apple 계정·iTunes·iPhone Duo"가 없다.
- 네 `release_notes.txt`의 `- ` 항목이 `release.json`의 `patchNotes`와 같은 순서로 같다(`store:check`).
