# 서버 배포와 롤백

배포를 준비하거나 장애로 이전 이미지를 복구할 때 참고한다. 정본은 [deploy workflow](../../../.github/workflows/deploy.yml), [배포 스크립트](../../../scripts/deploy.sh), [production compose](../../../docker-compose.prod.yml), [Dockerfile](../Dockerfile)이다. 문서의 절차와 로컬 검증은 실제 운영 적용 완료의 증거가 아니다.

## 로컬 실행

`.nvmrc`의 Node.js와 루트 `packageManager`의 pnpm과 Docker Compose V2를 사용한다. 개발 compose는 [`docker-compose.yml`](../../../docker-compose.yml) 하나다. `pnpm docker:up`은 DB(host 5433)만, `pnpm docker:dev:up`은 같은 DB에 migrate → API까지 띄운다(profile `api`). migrate·API 컨테이너는 `apps/api/.env.development`를 읽고 DB 주소만 compose 네트워크의 `db`로 덮는다. 포트(`DB_PORT`·`API_HOST_PORT`)는 셸 env로 바꾼다.

```sh
cp apps/api/.env.example apps/api/.env.development
pnpm docker:dev:build
pnpm docker:dev:up
pnpm docker:dev:logs
```

개발 compose는 DB health→migrate 완료→API 순서이고 source volume으로 재시작을 지원한다. 운영 compose는 서버에서 `scripts/deploy.sh`만 실행한다. production compose는 원격 migration을 허용하므로 로컬에서 띄우지 않는다(로컬 `apps/api/.env`는 운영 값 사본이다).

## 배포 흐름 (Blue-Green)

main의 API 영향 변경에서 CI 검증이 성공하면 ARM64 API와 migrate 이미지를 같은 40자리 SHA 태그로 GHCR에 발행한다. deploy workflow는 이미지 발행 job 성공 여부와 두 태그를 확인한 뒤 해당 SHA를 선택한다. 배포 시점의 main HEAD를 임의로 대신 쓰지 않는다. API 영향이 없어 image job을 건너뛴 run은 자동 배포하지 않는다.

API 컨테이너 자리는 둘이다: blue(`127.0.0.1:8080`)와 green(`127.0.0.1:8081`). 평소에는 Nginx가 가리키는 한 슬롯만 떠 있고, 지금 어느 슬롯이 살아 있는지는 `/etc/nginx/aido-api-upstream.inc` 한 줄이 정한다.

```text
① migrate → ② 쉬는 슬롯에 새 API 기동 → ③ Docker healthy + /health 확인
  → ④ upstream 파일을 새 슬롯으로 쓰고 nginx -t → reload(새 worker가 뜬 것을 확인)
  → ⑤ 옛 Nginx worker가 받던 요청을 끝내고 빠질 때까지 대기 → ⑥ 옛 API 종료(하던 작업을 끝낸 뒤)
```

- ①~③에서 실패하면 새 컨테이너만 지운다. ④에서 `nginx -t`나 reload가 실패하면 upstream 파일을 옛 슬롯으로 되돌리고 새 컨테이너를 지운다. 어느 쪽이든 살아 있는 API는 건드리지 않는다.
- ⑤를 두는 이유: `reload`는 비동기라 직후 잠깐은 옛 worker가 새 요청을 옛 슬롯으로 보낸다. 곧바로 옛 API를 내리면 그 요청이 502가 된다(로컬 전환 연습에서 확인).
- ②~⑥ 동안 두 API가 같이 돌고 둘 다 worker를 돌린다. 작업 꺼내기(`SKIP LOCKED`)와 정기 작업 발행은 DB가 조정해 겹치지 않는다. 그 사이 옛 코드와 새 코드가 같은 DB를 쓰므로 migration은 옛 코드와 호환되어야 한다([영속성](persistence.md#마이그레이션)).
- 전환 뒤에 배포가 끊겨 옛 컨테이너가 남으면 다음 배포가 시작할 때 Nginx를 upstream 파일에 맞추고 그 슬롯을 치운다. 그때까지 두 컨테이너가 같이 돈다.
- 겹치는 동안 두 프로세스의 메모리 캐시는 따로다. 그 사이 push token을 다시 등록한 기기는 다른 프로세스의 캐시(최대 5분)가 지날 때까지 알림을 옛 token으로 받을 수 있다.
- 운영 compose는 `JOB_WORKER_ENABLED`를 `true`로 고정한다. env 파일에서 끄면 두 슬롯이 모두 worker를 끄기 때문이다. API와 worker를 나눌 때 compose에 worker 서비스를 더하며 바꾼다([확장](scaling.md#확장-단계)).
- 대량 공지를 보내는 중에는 배포하지 않는다. 두 프로세스가 같이 보내면 Expo 초당 한도를 넘을 수 있다([확장](scaling.md#인스턴스를-2대-이상으로-늘릴-때)).

deploy workflow는 같은 저장소의 main push/dispatch로 끝난 CI run만 배포한다. 접속은 러너의 OpenSSH이고 host key는 `EC2_SSH_HOST_KEYS` secret(서버 `/etc/ssh/ssh_host_*_key.pub`의 `종류 키` 줄)으로 고정한다. 없으면 배포가 시작되지 않는다. 서버를 새로 만들어 host key가 바뀌면 `ssh <서버> 'for f in /etc/ssh/ssh_host_*_key.pub; do cut -d" " -f1,2 "$f"; done' | gh secret set EC2_SSH_HOST_KEYS`로 다시 넣는다. 토큰은 stdin 스크립트로만 넘긴다.

서버 repository는 `~/apps/Aido-platform`, 배포 상태는 `~/apps/deploy-state`다. workflow와 서버 `flock`이 동시 배포를 막는다. script는 작업 tree SHA·기존 배포 ancestry·운영 env(`apps/api/.env`, 600)를 확인한다. 이미지는 GHCR의 SHA 태그를 pull만 하고(`--pull never`로 준비된 이미지만 기동) 서버에서 빌드하지 않는다. 성공 뒤 현재와 직전 배포 이미지만 남긴다.

API container는 내부 포트 8080, memory 512M/CPU 1, Node heap 384MiB이고 읽기 전용 루트(`/tmp`만 tmpfs)·capability 전부 제거·`no-new-privileges`로 돈다. 공개 경로는 host Nginx→loopback API 한 홉이며 서버는 이 proxy 경계를 따른다.

## 수동 배포

CI가 이미지를 만들지 않은 커밋(API 범위 밖 변경)을 배포하려면 `gh workflow run ci.yml --ref main`으로 CI를 다시 돌린다. 이미지가 발행되면 deploy workflow가 이어서 배포한다.

Actions를 쓸 수 없을 때만 Mac에서 빌드한다. 서버(메모리 2GB)에서 빌드하면 swap을 쓰고 BuildKit cache가 5GB까지 쌓여 dockerd 메모리도 커졌다. 빌드 정의는 CI와 같은 [docker-bake.hcl](../../../docker-bake.hcl) 하나다.

1. Mac: `origin/main`에 있는 커밋을 변경 없는 tree로 checkout하고 `docker login ghcr.io`(write:packages)를 해 둔다. CI와 같은 기준의 trivy 검사를 통과한 이미지만 올린다.

   ```sh
   git switch main && git pull --ff-only && git status --short   # 출력이 없어야 한다
   export TAG=$(git rev-parse HEAD)
   docker buildx bake -f docker-bake.hcl
   for image in api migrate; do
     trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 "ghcr.io/aiddoo/aido-platform-$image:$TAG" \
       && docker push "ghcr.io/aiddoo/aido-platform-$image:$TAG" || break
   done
   ```

2. 서버: 같은 SHA로 배포한다.

   ```sh
   cd ~/apps/Aido-platform && git fetch origin main \
     && git merge-base --is-ancestor <sha> origin/main && git reset --hard <sha> \
     && DEPLOY_SHA=<sha> bash scripts/deploy.sh
   ```

수동 이미지에는 CI attestation이 없고, GHCR 보존 개수 정리는 다음 CI image job이 한다.

**서버 GHCR 읽기 토큰 (1회)**: `read:packages`만 가진 classic PAT를 만료일을 정해 만들고 서버에 소유자 전용 파일로 둔다. 토큰을 명령 인자·shell history에 남기지 않는다. 로그인에 실패하면 `GHCR_USER=<GitHub 로그인>`을 앞에 붙인다. 이미지가 이미 서버에 있으면(직전 버전 롤백) 토큰 없이 배포된다.

```sh
install -m 600 /dev/null ~/apps/deploy-state/ghcr-read-token
read -rs t && printf '%s\n' "$t" > ~/apps/deploy-state/ghcr-read-token; unset t
```

## DB 전환: API보다 먼저 적용

migrate 이미지(`tooling/database-migrate`)는 Drizzle 마이그레이션 폴더와 DB guard만 가진다. 규칙은 [영속성](persistence.md#마이그레이션)을 따른다.

`migrate.mjs`는 API·pg-boss URL을 먼저 검증한 뒤 pg-boss migration, Drizzle migration 순서로 실행한다. 원격 DB는 의도한 배포의 `AIDO_ALLOW_REMOTE_DB=1`일 때만 허용하며, DDL lock_timeout은 5초다. Drizzle은 미적용 마이그레이션을 한 트랜잭션에서 돌려 하나라도 실패하면 모두 되돌아가고 이전 API가 그대로 돈다. migrate 동안에도 이전 API가 트래픽을 받는다.

| DB 상태                       | 처리                                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| 빈 DB                         | baseline부터 모든 마이그레이션 적용                                                           |
| Drizzle 기록이 있는 DB(운영)  | 아직 적용하지 않은 마이그레이션만 적용                                                        |
| Drizzle 기록이 없는 오래된 DB | 지원하지 않는다. 로컬 개발 볼륨이면 `docker compose … down -v`로 지우고 빈 DB에서 다시 만든다 |

## Job과 종료

durable job은 PostgreSQL(pg-boss)만 쓴다. Redis는 `CACHE_TYPE=redis`·`PUSH_RATE_LIMIT_BACKEND=redis`를 고른 경우에만 연결한다.

job runtime의 기본 graceful 종료 대기는 `JOB_SHUTDOWN_TIMEOUT_MS=90000`이며 production Compose의 `stop_grace_period`는 120초다. 기본 작업 대기 뒤 HTTP·자원 종료 여유를 둔다. 종료 대기를 더 길게 설정한다면 Compose 유예도 함께 늘린다. 제한 시간을 넘는 작업의 완료나 모든 background 작업의 drain까지 보장하는 설정은 아니다. 실제 적용 값과 active 작업 상태는 배포 후 확인한다.

delivery fence·receipt·남는 전달 한계는 [푸시 발송](push-delivery.md#deliveryreceipt)에 있다. 배포 중 리마인더·푸시를 잃지 않는 기준은 [작업과 이벤트](jobs-and-events.md#배포-중-내구성)에 있다.

배포 시각: 03:00~03:40 KST(일간 정리 작업)와 07:00~08:00 KST(아침 리마인더 몰림)를 피한다. 놓친 실행은 `missed`·워터마크가 보완하지만 사용량이 적은 시간을 고른다.

## 롤백의 범위

실패한 배포는 살아 있는 API를 건드리지 않으므로 자동 롤백이 없다. 배포가 끝난 뒤 이전 버전으로 돌아가려면 그 SHA를 다시 배포한다: workflow 수동 실행에 SHA와 force를 주거나, 서버에서 `git reset --hard <sha> && DEPLOY_SHA=<sha> FORCE_DEPLOY=1 bash scripts/deploy.sh`다. 직전 배포 이미지는 서버에 남아 있어 pull 없이 된다. 이 배포도 migrate를 실행하지만 적용할 것이 없고, 이미지를 되돌려도 스키마와 업무 데이터는 되돌아가지 않는다.

Blue-Green으로 바꾼 커밋 이전으로는 되돌리지 않는다. 그 이전의 배포 스크립트는 슬롯과 upstream 파일을 몰라 성공으로 끝나도 Nginx가 넘어가지 않는다. deploy workflow는 그런 SHA를 거절한다.

배포 순서는 서버 → 안정화 확인 → 앱이다. 모바일은 최신 서버 응답만 읽으므로 앱 출시 뒤에는 서버를 그 릴리스 이전으로 되돌리지 않고 수정 배포로 대응한다. 릴리스마다 다른 되돌리기 SQL·배포 전 건수 확인은 그 릴리스 문서(`docs/releases/<버전>/`)에 둔다.

모든 과거 이미지의 스키마·동작 호환을 보장하지 않는다. 파괴적 DDL·데이터 변환의 되돌리기는 별도 forward migration 또는 검토된 복구 절차가 필요하다. DB를 drop하지 않는다.

새 cursor를 발급한 API를 이전 형식으로 되돌리면 클라이언트가 첫 페이지부터 다시 조회해야 할 수 있다. 공개 routing/payload·개인정보 보정처럼 API와 스키마가 함께 바뀌는 릴리스는 그 릴리스 노트(`docs/releases`)의 제한을 함께 확인한다.

## 서버 설정과 관리

호스트 설정의 정본은 저장소에 있다. 서버를 새로 만들거나 파일을 고쳤을 때 아래대로 설치한다.

| 정본                                                                            | 설치 위치                                        | 반영                                                |
| ------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------- |
| [Nginx 사이트](../../../scripts/ops/nginx/api.aido.kr.conf)                     | `/etc/nginx/sites-available/api.aido.kr`         | `sudo nginx -t && sudo systemctl reload nginx`      |
| [Docker 데몬](../../../scripts/ops/docker-daemon.json)                          | `/etc/docker/daemon.json`                        | `sudo dockerd --validate --config-file …` 뒤 재시작 |
| [자동 보안 패치·재부팅](../../../scripts/ops/host/apt-unattended-upgrades.conf) | `/etc/apt/apt.conf.d/52aido-unattended-upgrades` | 다음 실행부터                                       |
| [저널 크기](../../../scripts/ops/host/journald.conf)                            | `/etc/systemd/journald.conf.d/aido.conf`         | `sudo systemctl restart systemd-journald`           |
| [SSH](../../../scripts/ops/host/sshd.conf)                                      | `/etc/ssh/sshd_config.d/10-aido.conf`            | `sudo sshd -t && sudo systemctl reload ssh`         |

- Nginx를 처음 설치할 때는 살아 있는 슬롯 파일을 먼저 만든다: `echo 'server 127.0.0.1:8080;' | sudo tee /etc/nginx/aido-api-upstream.inc`. 이후에는 배포 스크립트만 이 파일을 쓴다. 인증서는 certbot(`certbot.timer`, nginx 플러그인)이 갱신한다. Nginx 설정을 바꾼 뒤에는 `sudo certbot renew --dry-run`으로 갱신이 되는지 본다.
- OS 보안 패치는 `unattended-upgrades`가 매일 적용하고, 재부팅이 필요한 패치는 05:00 KST(20:00 UTC)에 스스로 재부팅한다. 재부팅은 1분 안팎 멈추고 컨테이너는 `restart: unless-stopped`로 다시 뜬다. 멈춘 동안의 리마인더는 sweep이 따라잡는다([Job과 종료](#job과-종료)).
- 메모리를 비우는 cron을 두지 않는다. `free`의 buff/cache는 커널이 필요할 때 내주는 캐시다. 상한은 컨테이너 memory 512M과 Node heap 384MiB가 정한다.
- 재부팅 뒤 확인: `docker ps`(healthy), 살아 있는 슬롯의 `/health`, 5분 안에 큐 작업이 completed로 쌓이는지, `free -m`(스왑).
- DB 백업은 서버 cron(03:00 UTC)이 [backup-database.sh](../../../scripts/ops/backup-database.sh)를 저장소 경로에서 바로 실행한다(`0 3 * * * bash ~/apps/Aido-platform/scripts/ops/backup-database.sh >> ~/backups/backup.log 2>&1`). 접속 주소·S3 경로는 `~/apps/backup.env`(권한 600), 비밀번호는 `~/.pgpass`에 둔다. RDS 자동 백업(7일)과 따로 도는 두 번째 사본이다.
- 백업 버킷은 버전 관리를 켜 두고 [수명주기](../../../scripts/ops/s3/backup-lifecycle.json)가 지운다: `daily/`는 30일 뒤 만료하고, 만료되거나 지운 파일의 옛 버전은 버킷 전체에서 7일 뒤 완전히 지운다(`aws s3api put-bucket-lifecycle-configuration --bucket <버킷> --lifecycle-configuration file://scripts/ops/s3/backup-lifecycle.json`). 옛 버전 규칙이 없으면 만료된 덤프가 숨겨진 채 계속 남는다. 서버 역할은 올리기·읽기·목록만 갖고 지우지 못한다.
- `REDIS_URL`은 `CACHE_TYPE=redis`로 여러 대를 운영할 때만 둔다([확장](scaling.md#인스턴스를-2대-이상으로-늘릴-때)). 큐는 pg-boss라 Redis가 필요 없다.

## 공개 버전과 env 반영

env 목록과 규칙은 [설정](configuration.md), 운영 경보를 사람에게 보내는 Sentry 규칙은 [관측](observability.md#sentry-무료-플랜-운영)에 있다.

Swagger는 개발 도구가 켜진 로컬 실행에서만 `/api/docs`, `/api/admin/docs`로 제공한다(배포된 개발서버는 열지 않는다). OS push 권한·외부 공급자 도착·LLM 의미 품질은 `/health` 성공만으로 확인되지 않는다.

스토어 공개 버전(DB `AppRelease`, `/v1/app-config/app-version`)은 앱 설정의 "버전 정보"를 누를 때만 쓰인다. 서버 값보다 낮은 앱은 그 탭에서 스토어를 연다. 앱을 열 때 뜨는 업데이트 안내나 강제 업데이트는 없고 API 접근도 막지 않는다.

- **올리기**: 플랫폼마다 그 스토어에서 실제로 업데이트를 받을 수 있게 된 뒤에 올린다. 그 전에 올리면 사용자가 스토어에 가도 "열기"만 보인다.
  - Android: 100% 출시하고 Play 화면에 업데이트가 보인 뒤. 단계 출시 대상이 아닌 기기는 업데이트를 받을 수 없다.
  - iOS: 공개(Ready for Sale) 뒤. 단계적 출시 중에도 App Store에서 직접 업데이트할 수 있다.
  - 두 값은 따로 정한다. 한쪽만 공개됐으면 그 플랫폼만 부르고 다른 쪽은 이전 공개값을 둔다.
- **반영**: 관리자 계정(role `ADMIN`)의 access token으로 플랫폼마다 관리자 API를 한 번 부른다. env를 고치거나 서버를 다시 배포하지 않고 다음 조회부터 바뀐다. 버전은 그 release의 실제 공개값(MAJOR.MINOR.PATCH)이다.
- **되돌리기**: 이전 공개값으로 다시 부른다. 끄는 방법은 두지 않는다. 1.10.0~1.15.0 앱은 꺼진 응답을 실패로 보고 "버전 정보를 확인하지 못했어요"를 띄운다.
- **env 대체**: DB에 행이 없는 플랫폼은 env `APP_VERSION_CHECK_*` 값으로 응답한다. 두 플랫폼을 한 번씩 반영한 뒤에는 env 값을 읽지 않는다. 지울 시점은 [호환](../../../docs/conventions/compatibility.md)에 있다.
- **응답 모양**: `/v1/app-config/app-version` 응답에 칸을 더하지 않는다. 1.10.0 이후 출시 앱이 strict로 읽어 버전 확인이 실패한다([app-config-released-client.e2e-spec.ts](../test/e2e/app-config-released-client.e2e-spec.ts)). 자동·강제 업데이트 안내를 만들면 envelope 응답의 새 endpoint를 연다.

```sh
# <플랫폼>은 ios 또는 android
curl -fsS -X PUT "https://api.aido.kr/v1/admin/app-config/app-releases/<플랫폼>" \
  -H "Authorization: Bearer <관리자 토큰>" -H "Content-Type: application/json" \
  -d '{"latestVersion":"<공개 버전>"}'
curl -fsS https://api.aido.kr/v1/app-config/app-version
```

운영 env는 서버의 `~/apps/Aido-platform/apps/api/.env`(권한 600, git이 무시함) 하나다. 값은 화면에 찍지 않는다: 바꿀 때는 편집기로 고치고, 비교는 키 이름과 해시로 한다.

env를 반영할 때는 값을 고친 뒤 같은 SHA를 다시 배포한다. 새 슬롯이 새 env로 뜨고 healthy가 된 뒤에 전환하므로 끊기지 않고, env가 잘못돼 기동하지 못하면 살아 있는 API가 그대로 남는다. `docker restart`는 env_file 변경을 반영하지 않는다.

```sh
cd ~/apps/Aido-platform
DEPLOY_SHA=$(cat ~/apps/deploy-state/last_deployed_sha) bash scripts/deploy.sh
```

`docker compose config`로 확인할 때는 값이 찍히지 않게 `--quiet`를 붙인다.

PR·stack 규칙은 [Git](../../../docs/conventions/git.md)에 있다. 검증 완료·merge 완료·이미지 발행·배포 health·실제 DB verify는 각각의 결과로 기록하며, 이 문서는 아직 수행하지 않은 작업을 완료로 표시하지 않는다.
