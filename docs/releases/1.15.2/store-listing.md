# 1.15.2 스토어 업데이트 내용

원본은 [listing](../../../apps/mobile/store-metadata/listing/README.md)의 `release_notes.txt` 네 개와 [release.json](../../../apps/mobile/store-metadata/1.15.2/release.json)의 `patchNotes`다. 이 문서는 문장을 고른 근거를 남긴다. App Store와 Google Play의 같은 언어 문장은 같아야 하므로(`store:check`가 비교한다) 짧은 Play 한도 500자에 맞췄다. 글자 수는 `store-listing.mjs`의 `characterCount`(유니코드 글자)로 셌다.

## 문장

한국어(App Store `ko`, Play `ko-KR`, 264/500자):

```text
개선
- 메모나 할 일을 고치는 동안 쓰던 글이 사라지지 않고, 저장을 다시 눌러도 메모는 하나만 생겨요.
- 달력과 위젯, 리포트의 주차를 같은 기준으로 보여 드려요.
- 큰 화면에서도 목록이 좁아지지 않고, 날씨와 말로 메모하기 화면이 더 가볍고 부드러워졌어요.
- 글자를 키우면 아이콘도 함께 커지고, 스크린리더로 메모를 고정하거나 지울 수 있어요.

버그 수정
- 계정을 바꾼 직후 결제가 이전 계정에 잡힐 수 있던 문제와 로그아웃 뒤 알림이 남던 문제를 고쳤어요.
```

영어(App Store `en-US`, Play `en-US`, 446/500자, `en-GB`는 `en-US`를 물려받는다):

```text
Improvements
- Your edits to memos and to-dos stay safe, and saving again makes just one memo.
- Calendar, widgets, and reports now count weeks the same way.
- Lists keep their width on big screens, and weather and voice notes run smoother.
- Icons grow with your text size, and screen readers can pin or delete memos.

Bug fixes
- Fixed purchases right after switching accounts going to the old account, and notifications staying after sign-out.
```

## 문장마다 근거

| 줄  | 근거 커밋(출시 기록의 해당 절)                                                                  |
| --- | ----------------------------------------------------------------------------------------------- |
| 1   | 수정 폼 `a5557189c`·`feabe06ed`, 메모 `Idempotency-Key` `17f1f52e2`·`d8390652e`(데이터 안전)    |
| 2   | 주차 `dcb6dbd8b`·`4a276ac60`(의도한 화면 차이 > 주차). 화면 글자가 바뀌므로 알린다              |
| 3   | iPad 사이드바 `925d11834`, 음성 파형 `efa07f79f`, 날씨 장면 `ffd643abb`·`7704ae54b`(배치, 성능) |
| 4   | 아이콘 글꼴 배율 `902b0a2c7`·`d6a6b6401`·`3b0942daf`, 스크린리더 동작 `9d836e6af`(접근성)       |
| 5   | 결제 귀속 `1f3f506f1`, 알림 센터 비우기 `09d08f250`(데이터 안전, 알림)                          |

해시는 `chain-38`의 커밋이다.

## 쓰지 않은 것

- 구조 정리·리팩터링·린트·오류 처리 층 같은 내부 작업.
- 탈퇴 뒤 기기 기록 정리, 서버 오류 코드처럼 사용자가 화면에서 알아보기 어려운 변경. [출시 기록](README.md)에만 둔다.
- 3번 줄은 iPad만 바뀌었지만 "큰 화면"으로 썼다. 두 스토어 문장이 같아야 하는데 Play 쪽에 iPad를 쓰기 어색하다. Android 큰 화면은 원래부터 좁아지지 않았으므로 틀린 말은 아니다.
- "새로운 기능" 절은 없다. 수정과 개선만 다섯 줄 안에 담았다.

## 검사

- `pnpm --filter @aido/mobile store:check` 통과, `test:store-listing` 4/4.
- 브랜드: 한국어에 "Aido"가 없고 영어에 한글이 없다. "Pro"가 없다.
- 금지어: App Store 쪽 "Google Play·갤럭시·Galaxy", Play 쪽 "App Store·Apple 계정·iTunes·iPhone Duo"가 없다.
- 용어: 앱 문구와 같은 "말로 메모하기", "Memos", "Pin memo", "voice notes", "to-dos".
