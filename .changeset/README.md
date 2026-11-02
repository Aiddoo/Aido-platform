# Changesets

서버(`@aido/server`)·공유 계약(`@aido/api`)을 바꾸는 PR은 `pnpm changeset`으로 변경 파일을 함께 올린다. 변경 파일은 릴리스 때 CHANGELOG 항목이 된다.

릴리스 버전은 앱 버전(`apps/mobile/package.json`) 하나다. 릴리스 PR에서 `pnpm version-packages`를 실행하면 `changeset version`이 변경 파일을 CHANGELOG로 소비하고, `scripts/release/sync-versions.mjs`가 서버·계약 버전과 CHANGELOG 제목을 앱 버전으로 맞춘다. 규칙은 [git 규칙](../docs/conventions/git.md#버전)을 따른다.
