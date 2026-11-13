# 1.15.0 스토어 문구 초안

**상태: 초안.** 화면 문구와 한도는 코드 `42c2c30a2`와 맞췄다. QA가 끝나고 문구를 확정한 뒤 `apps/mobile/store-metadata/listing/`에 옮긴다. 이 문서는 listing 파일을 바꾸지 않으므로 `store:check`의 검사 대상이 아니다. 옮길 때 `apps/mobile/store-metadata/1.15.0/release.json`의 `patchNotes`를 아래 릴리스 노트의 `- ` 항목과 같은 순서로 만들고, `pnpm --filter @aido/mobile store:check`로 글자 수와 용어를 검사한다.

글자 수는 유니코드 글자 기준으로 센 값이다(`store-listing.mjs`의 `characterCount`와 같은 방식). 아래 값과 같은 `release.json`을 저장소 밖 임시 복사본 listing에 넣어 `store:check`를 돌렸고 통과했다(2026-11-09).

## 공통 원칙

- 기능 이름은 [i18n 가이드](../../../apps/mobile/docs/dates-and-i18n.md)의 고정 용어를 쓴다: 말로 할 일 만들기 / Speak to add, 말로 메모하기 / Voice notes, AI 할 일 만들기 / AI to-dos.
- 한국어는 해요체 문장과 명사형 항목을 쓴다. 영어는 sentence case다. 앱 문구와 같게 "회", "초기화", "정기결제"를 쓴다.
- "무제한"은 실제로 상한이 없는 것(친구·콕 찌르기·응원)에만 쓴다. 프리미엄 AI는 공정 사용 상한이 있으므로 "넉넉하게(월 1,000회까지)"로 쓴다. "AI 무제한"이라고 쓰지 않는다.
- 무료 체험은 연간 구독을 처음 시작하는 계정 가운데 스토어가 대상이라고 한 계정만 받는다. 그래서 "받을 수 있어요 / may get"으로 쓰고, 모두가 받는다고 쓰지 않는다.
- 이름·부제·키워드는 1.14.0 값을 그대로 둔다(이번에 바꾸지 않음). 바뀌는 곳은 설명과 릴리스 노트다. 홍보 문구는 아래 초안을 쓴다.

## App Store

### 한국어 (ko)

**promotional_text** (63/170자)

> 말하면 AI가 할 일로 나눠드려요. 녹음 파일은 아이두 서버로 보내지 않고, 저장 전에 하나씩 확인할 수 있어요.

**description** (2,924/4,000자)

```text
할 일 관리, 혼자 하니까 안 되셨죠?

아이두는 AI와 친구의 힘으로 매일의 할 일을 끝까지 해내도록 도와주는 소셜 투두 앱이에요.
말 한마디면 할 일이 정리되고, 친구와 함께하니 꾸준히 해낼 수 있어요.

[ 친구 초대하고 프리미엄 받기 ]
- 초대 링크를 카카오톡이나 다른 앱으로 보내고, 6자리 초대 코드로도 초대
- 친구: 가입한 지 7일 안에 초대를 수락하면 바로 프리미엄 7일
- 나: 친구가 가입하고 14일 안에 2일 동안 할 일을 끝내면 프리미엄 7일 + 친구 1명 더 추가 (하루에 여러 개를 끝내도 1일)
- ‘발자국 모으기’에서 모은 발자국과 받은 보상을 한눈에 확인
- 보상은 아이두 안에서만 쓰는 프리미엄 기간으로 현금 교환 불가, 같은 기기·계정은 한 번만
- 초대로 받는 프리미엄은 30일 동안 최대 30일, 전체 최대 90일까지 (자세한 조건은 이용약관)

[ AI가 도와주는 똑똑한 할 일 관리 ]
- 말로 할 일 만들기: 말하면 글자로 바꾸고 AI가 할 일·날짜·시간으로 나눠요
- 나눠진 할 일을 하나씩 확인하고 고쳐서 저장해요. 저장하기 전에는 아무것도 추가되지 않아요
- ‘다음 주 금요일’, ‘3일 후’, ‘월말’도 내 시간대의 오늘을 기준으로 정확하게
- "매주 월수금 운동" 한마디로 반복 할 일 자동 생성
- 말로 메모하기: 긴 이야기를 말로 남기면 요약, 핵심 포인트, 할 일로 정리
- 녹음 파일은 아이두 서버로 보내지 않고, 글자만 보내요
- 메모 한 장을 AI가 여러 개의 할 일로 정리
- 내가 여러 번 해온 할 일을 바탕으로 AI가 반복 할 일 제안 (프리미엄)
- 주간·월간 AI 리포트로 완료율·카테고리·요일별 패턴 분석 (프리미엄)

[ 날씨와 함께 챙기는 하루 ]
- 전 세계 어디서나 지금 날씨와 시간별·10일 예보 확인
- 앞으로 1시간 동안의 비 소식을 분 단위로 확인 (지원 지역)
- 아이두 브리핑이 오늘 할 일 시간과 그때의 날씨를 함께 알림
- 비나 더위와 겹친 할 일은 더 나은 시간으로 한 번에 옮기고, 마음이 바뀌면 되돌리기
- 아침·저녁 날씨 알림으로 오늘 할 일과 날씨를 함께 확인
- 체감 온도·자외선·바람·습도·일출·일몰, 한국에서는 미세먼지까지

[ 친구와 함께하는 동기부여 ]
- 유저 태그(#)로 친구를 찾고 서로의 할 일을 피드에서 확인
- 게으름 피울 때 콕 찔러주기로 자극
- 할 일을 다 끝낸 친구에게 응원 메시지 보내기

[ 한눈에 보는 나의 성장 ]
- 주간·월간 캘린더에서 일별 달성률 확인
- 연속 기록으로 꾸준함을 확인

[ 깔끔한 일정 관리 ]
- 카테고리별 컬러 태그로 할 일 분류
- 날짜·시간 설정으로 일정처럼 관리
- 하위 할 일로 큰 할 일을 잘게 나누기
- 반복 할 일로 매주 루틴 자동 생성
- 드래그 앤 드롭으로 우선순위 정렬
- 공개/비공개 설정으로 보여줄 것만 선택
- 인터넷이 끊겨도 마지막으로 본 할 일과 날씨 확인

[ 나에게 맞는 리마인드 알림 ]
- 매일 아침·저녁 리마인드 알림으로 하루를 시작하고 마무리
- 할 일 시작 1시간 전·10분 전 자동 알림
- 리마인드 시간 자유롭게 바꾸기 (프리미엄)

[ 홈 화면 위젯 ]
- 작은·중간·큰 크기로 오늘 할 일과 달성률, 연속 기록을 홈 화면에서 확인
- 큰 위젯은 이번 주 7일과 할 일을 다 끝낸 날의 발자국까지 한눈에
- 할 일이나 날짜를 누르면 앱에서 바로 열고, ‘＋ 할 일 만들기’로 새 할 일 작성
- 자정이 지나면 앱을 열지 않아도 새 날짜로 바뀜

[ 취향대로 꾸미기 ]
- 라이트 / 다크 / 시스템 테마 지원
- 8가지 고양이 테마 프리미엄 앱 아이콘

[ 큰 화면에서도 편하게 ]
- iPhone Duo를 펼치면 목록과 상세를 나란히, 접고 펼쳐도 보던 화면 그대로

[ 간편한 시작 ]
- 카카오 · 구글 · 네이버 · Apple 소셜 로그인
- 이메일 회원가입도 가능
- 초대 코드가 있다면 로그인 화면에서 바로 입력

지금 아이두와 함께 오늘의 할 일부터 시작해보세요.

[ 구독 안내 ]

아이두의 기본 기능은 무료예요.
무료에서는 AI 할 일 만들기(글·말·메모 공통)를 월 10회, 말로 메모하기를 월 3회(회당 3분까지) 쓸 수 있어요. 친구는 5명, 카테고리는 3개, 콕 찌르기·응원은 하루 3회씩이에요. 할 일 추가와 완료는 무료에서도 그대로 쓸 수 있어요. 녹음 다시 듣기와 핵심 포인트 이동은 무료에서도 쓸 수 있어요.

아이두 프리미엄을 구독하면 아래 기능을 쓸 수 있어요.
- AI 할 일 만들기 넉넉하게 (월 1,000회까지)
- 말로 메모하기 월 100회 (회당 30분까지)
- AI 주간·월간 리포트
- AI 반복 제안
- 리마인드 시간 자유롭게 바꾸기
- 친구 추가·콕 찌르기·응원 무제한
- 카테고리 최대 30개
- 프리미엄 앱 아이콘 (고양이 테마 8종)

친구 초대로 받은 프리미엄에서도 같은 기능을 쓸 수 있어요. 구독 중에 받은 보상은 구독이 끝난 뒤 이어서 시작돼요.

- 아이두 프리미엄은 월간·연간 자동 갱신 구독이에요. 가격과 기간은 구매 전에 앱에서 보여드려요.
- 연간 구독을 처음 시작하면 2주 무료 체험을 받을 수 있어요(스토어가 대상으로 정한 계정). 체험이 끝나기 전에 해지하지 않으면 연간 구독료가 정기결제되고, 끝나기 3일 전에 알려드려요.
- 구독료는 구매를 확인하면 Apple 계정으로 청구돼요.
- 현재 구독 기간이 끝나기 최소 24시간 전에 자동 갱신을 끄지 않으면 자동으로 갱신돼요.
- 구독은 구매 후 기기 설정에서 관리할 수 있어요.

이용약관: https://aido.kr/ko/terms
개인정보처리방침: https://aido.kr/ko/privacy

[ 데이터 출처 ]
- 날씨: Apple 날씨(Apple Weather). 데이터 출처 안내: https://weatherkit.apple.com/legal-attribution.html
- 한국 대기질(미세먼지): 에어코리아(한국환경공단), 공공데이터포털(data.go.kr)
```

**release_notes** (387/4,000자. Play 한도 500자도 넘지 않는다)

```text
새로운 기능
- 말로 할 일 만들기: 말하면 AI가 할 일로 나눠요. 저장 전에 하나씩 확인해요.
- 말로 메모하기: 긴 이야기를 요약과 핵심 포인트, 할 일로 정리해요.
- 핵심 포인트를 누르면 그 지점부터 다시 들을 수 있어요.
- 연간 구독을 처음 시작하면 2주 무료 체험을 받을 수 있어요.

개선
- 반복 할 일은 이 할 일만, 이후 할 일까지, 반복 전체 중에 골라 고치거나 지울 수 있어요.
- 횟수를 다 쓰면 몇 회 썼는지와 언제 초기화되는지 알려 드려요.
- 프리미엄은 AI 할 일 만들기를 월 1,000회까지 넉넉하게 써요.
- 알림은 가입 직후 한 번만 묻고, 위치는 날씨를 볼 때만 물어요.

버그 수정
- 숨길 답글이 없는데도 '답글 숨기기'가 보이던 문제를 고쳤어요.
```

### English (en-US, en-GB가 물려받음)

`en-GB`는 키워드만 따로 두고 나머지 필드는 `en-US`를 물려받는다. 그래서 영국 스토어의 "What's New"도 아래 en-US 문장과 같다.

**promotional_text** (128/170자)

> Say it and Aido sorts it into to-dos. Audio files aren't sent to Aido's servers, and you can check each to-do before it's saved.

**description** (3,983/4,000자)

```text
Keep putting off your to-dos? Get them done with friends.

Aido is a social to-do app with AI to plan and friends to keep you going.

[ Invite friends and earn Premium ]
- Share an invite link (KakaoTalk or any app) or a 6-character invite code
- Your friend: 7 days of Premium if they accept within 7 days of joining
- You: 7 days of Premium + 1 more friend once they complete to-dos on 2 days within 14 days of joining
- Track rewards in “Collect paw prints”
- Rewards are in-app Premium with no cash value, once per device and account
- Up to 30 days of Premium per 30 days, 90 days in total (see Terms of Use)

[ Smart to-dos with AI ]
- Speak to add: AI drafts to-dos you check before saving
- Understands “next Friday” or “in 3 days” in your time zone
- Say “work out every Mon, Wed, and Fri” for a repeating to-do
- Voice notes: summaries, key points, and to-dos
- Audio files aren't sent to Aido's servers. Only text is.
- AI splits one memo into several to-dos
- AI suggests repeats from to-dos you keep doing (Premium)
- Weekly and monthly AI reports on completion and patterns (Premium)

[ Plan around the weather ]
- Hourly and 10-day forecasts worldwide
- Minute-by-minute rain for the next hour (supported areas)
- Aido briefing matches today’s to-dos with the weather
- Move to-dos that clash with rain or heat, and undo anytime
- Morning and evening weather notifications
- UV, wind, sunrise and sunset, and air quality in Korea

[ Stay motivated with friends ]
- Find friends by user tag (#) and see their to-dos in the feed
- Nudge a friend who’s slacking off
- Send a cheer to friends who finish their day

[ See your progress ]
- Daily completion rates on weekly and monthly calendars
- Build streaks and stay consistent

[ Stay organized ]
- Sort to-dos with color-coded categories
- Add dates and times to plan like a calendar
- Break big to-dos into subtasks
- Drag and drop to prioritize
- Choose what’s public or private
- See your last-viewed to-dos and weather offline

[ Reminders that fit your day ]
- Morning and evening reminders to start and end your day
- Automatic alerts 1 hour and 10 minutes before a to-do starts
- Set your own reminder times (Premium)

[ Home Screen widgets ]
- Small, medium, and large sizes show today’s to-dos, progress, and streak
- The large widget adds your week and paw prints for fully finished days
- Tap a to-do or date to open it, or “+ Add to-do” to add one
- After midnight, widgets show the new day without opening the app

[ Make it yours ]
- Light, dark, or system theme

[ Made for bigger screens ]
- Unfold iPhone Duo to see your list and details side by side

[ Easy to start ]
- Sign in with Kakao, Google, Naver, or Apple, or sign up with email
- Have an invite code? Enter it on the sign-in screen

[ Subscription ]

Aido’s core features are free. On the free plan, you get 10 AI to-dos and 3 voice notes a month.

Subscribe to Aido Premium to unlock:
- Plenty of AI to-dos, up to 1,000 a month
- Voice notes: 100 a month, up to 30 minutes each
- Weekly and monthly AI reports
- AI repeat suggestions
- Custom reminder times
- Unlimited friends, nudges, and cheers
- Up to 30 categories
- Premium app icons (8 cat themes)

Premium from invites has the same features. Rewards earned while subscribed start after it ends.

- Aido Premium is a monthly or yearly auto-renewing subscription. Price and period are shown before you buy.
- New yearly subscribers may get 2 weeks free. Cancel before it ends, or the yearly price is charged.
- Payment is charged to your Apple Account at confirmation of purchase.
- It renews automatically unless auto-renew is turned off at least 24 hours before the current period ends.
- Manage your subscription in your device settings after purchase.

Terms of Use: https://aido.kr/en/terms
Privacy Policy: https://aido.kr/en/privacy

[ Data sources ]
- Weather: Apple Weather (https://weatherkit.apple.com/legal-attribution.html)
- Air quality in Korea: AirKorea via data.go.kr
```

**release_notes** (495/4,000자. Play 한도 500자도 넘지 않는다)

```text
New
- Speak to add: AI drafts to-dos you check before saving.
- Voice notes: summaries, key points, and to-dos.
- Tap a key point to listen from there.
- New yearly subscribers can get 2 weeks free.

Improvements
- Edit or delete one repeat, the ones after it, or all.
- Run out? See your usage and when it resets.
- Up to 1,000 AI to-dos a month on Premium.
- We ask for notifications once at sign-up, location only for weather.

Bug fixes
- "Hide replies" no longer shows with nothing to hide.
```

## Google Play

- `title`, `short_description`(ko·en)은 1.14.0 값을 그대로 둔다.
- `full_description`(ko·en)은 위 App Store 본문과 같다. 아래 다섯 곳만 Play용으로 바꾼다. 1.14.0과 같은 방식이다. 바꾼 뒤 길이는 ko 2,952/4,000자, en 3,988/4,000자다.
  1. 위젯 줄(ko): "2×2·4×2·4×4 세 가지 위젯으로 오늘 할 일과 달성률, 연속 기록을 홈 화면에서 확인" / "4×4 위젯은 이번 주 7일과 할 일을 다 끝낸 날의 발자국까지 한눈에" (en: "2×2, 4×2, and 4×4 widgets show ..." / "The 4×4 widget adds ...")
  2. 큰 화면 줄(ko): "폴더블 기기를 펼치면 목록과 상세를 나란히, 접고 펼쳐도 보던 화면 그대로" (en: "Unfold your foldable to see ...")
  3. 구독 결제 계정(ko): "구독료는 구매를 확인하면 Google Play 계정으로 청구돼요." (en: "Payment is charged to your Google Play account on purchase.")
  4. 구독 관리 경로(ko): "구독은 구매 후 Google Play 설정 > 구독에서 관리할 수 있어요." (en: "Manage your subscription in Google Play > Payments & subscriptions > Subscriptions.")
  5. 영문 제목만 다르다: "[ Home screen widgets ]"(Play) / "[ Home Screen widgets ]"(App Store). 나머지는 App Store와 같다.
- `release_notes`(ko·en)는 위 App Store 릴리스 노트와 같은 문장이다. `store:check`가 두 스토어의 같은 언어 문장이 같은지 본다. 길이는 ko 387/500자, en 495/500자다. 문장을 고치면 en이 500자에 가까우니 다시 센다.
