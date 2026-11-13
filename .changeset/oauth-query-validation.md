---
'@aido/api': patch
'@aido/server': patch
---

웹 OAuth `start`·`web-callback` query와 `PATCH /follows/friends/{followId}/reorder` path를 공유 schema(`oauthStartQuerySchema`·`oauthWebCallbackQuerySchema`·`followIdParamSchema`)로 검증한다. 출시 앱이 보내는 `redirect_uri`·`mode`(login·link)와 서버가 준 followId는 그대로 받고, 정하지 않은 `mode`·형식이 틀린 `user_hint`·followId만 400 `SYS_0002`가 된다. 공급자 화면에서 취소해 code 없이 온 콜백은 공급자에 교환을 묻지 않고 지금과 같은 `USER_0602`로 앱 딥링크에 돌려보낸다.
