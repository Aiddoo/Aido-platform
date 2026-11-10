---
'@aido/server': patch
---

댓글 커서와 광고 수신 거부 링크의 서명을 JWT 비밀값에서 떼어 `kid`가 붙은 키 묶음(선택 env `CURSOR_SIGNING_KEYS`·`OPT_OUT_TOKEN_SIGNING_KEYS`)으로 할 수 있게 한다. 값을 비우면 지금과 같은 형식으로 서명하고, 값을 넣어도 이미 보낸 링크와 커서는 계속 검증된다.
