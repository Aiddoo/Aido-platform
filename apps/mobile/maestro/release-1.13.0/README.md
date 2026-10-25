# 1.13.0 Native QA

Docker 개발 API(`EXPO_PUBLIC_API_URL=http://localhost:8080`)에 연결한 개발 빌드에서 로그인된 상태로 실행한다.
계정 비밀번호·token은 repository에 저장하지 않는다.

## 입력

| 변수                       | 의미                                               |
| -------------------------- | -------------------------------------------------- |
| `QA_DATE`                  | 확인할 날짜(`YYYY-MM-DD`)                          |
| `QA_TODO_TITLE`            | 그 날짜의 내 할 일 제목                            |
| `QA_FRIEND_NAME`           | 친구 줄 첫 화면에 보이는 친구 표시 이름            |
| `QA_FRIEND_TODO_TITLE`     | 그 친구의 같은 날짜 할 일 제목                     |
| `QA_FAR_FRIEND_ID`         | 친구 목록 첫 페이지(20명) 밖에 있는 친구의 user id |
| `QA_FAR_FRIEND_NAME`       | 그 친구의 표시 이름                                |
| `QA_FAR_FRIEND_TODO_TITLE` | 그 친구의 같은 날짜 할 일 제목                     |

```sh
maestro --device <device> test -e QA_DATE=… -e QA_TODO_TITLE=… … apps/mobile/maestro/release-1.13.0
```

## 흐름

| 파일                | 확인하는 것                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `friend-strip.yaml` | 친구 줄에서 친구 → 같은 날짜의 친구 할 일, "나" → 내 할 일 복귀, 첫 페이지 밖 친구 딥링크 표시 |
