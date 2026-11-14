# 스크립트·package scripts·turbo 작업

저장소 도구 스크립트, package.json scripts, turbo 작업을 더하거나 고칠 때 읽는다.

## 스크립트

- 저장소 도구는 Node ESM(`.mjs`)이고, 판단은 순수 함수로 두고 옆의 `*.test.mjs`(`node --test`)로 검사한다. 파서·검사기를 직접 짜기 전에 표준 라이브러리를 찾는다(문서 링크는 `remark-validate-links`).
- 공식 CLI·GitHub Action·라이브러리가 하는 일(`eas`, `gh`, `turbo`, `docker buildx bake`, `knip`)은 다시 만들지 않는다. 순서·안전 확인이 필요할 때만 얇게 감싼다.
- 저장소 전체 도구는 `scripts/<용도>/`(`ci`·`docs`·`ops`), 앱 하나에만 쓰는 도구는 `apps/<앱>/scripts/`에 둔다.
- 서버 호스트에서 도는 운영 도구(`scripts/ops/`)는 호스트에 있는 bash·python3만 쓴다(호스트에 Node가 없다). `scripts/deploy.sh`는 옮기지 않는다. 배포 workflow가 서버를 대상 커밋으로 되돌린 뒤 이 경로를 실행해, 옛 커밋 재배포가 깨진다.

## package.json scripts

- 루트 script는 `turbo run <작업>`으로 위임한다. 루트에서만 도는 작업(lint·format·docs·이름·knip)은 turbo 루트 작업(`//#<작업>`)이다.
- 이름은 하는 일이다. turbo `build`는 다른 패키지가 쓰는 산출물만 만든다(앱 번들 확인은 `export`).
- 공식 CLI를 인자만 바꿔 부르는 script는 만들지 않고 문서에 공식 명령을 쓴다.

## turbo 작업

- inputs에서 문서·`.md`를 빼고, `build`에서는 테스트 파일도 뺀다. 테스트가 읽는 파일(문서 표 대조 등)은 그 패키지 inputs에 넣는다.
- 내부 설정 패키지(`tooling/*`) 변경은 `transit` 작업으로 전파한다. 전역 의존성(`globalDependencies`)은 모든 캐시를 깨므로 정말 전부에 영향을 주는 파일만 둔다.
- 로컬 pre-push와 CI가 같은 작업 해시를 내야 원격 캐시를 같이 쓴다. env는 `env`(해시에 들어감)와 `passThroughEnv`(전달만)를 구분한다.
