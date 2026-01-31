# Aido API 배포 가이드

## 📋 목차

- [환경별 CORS 설정](#환경별-cors-설정)
- [배포 플랫폼별 가이드](#배포-플랫폼별-가이드)
- [환경 변수 설정](#환경-변수-설정)
- [배포 전 체크리스트](#배포-전-체크리스트)

---

## 🌐 환경별 CORS 설정

### ⚠️ 중요: 모바일 앱과 CORS

**네이티브 모바일 앱(iOS/Android)은 CORS 제약을 받지 않습니다!**

- CORS는 브라우저 보안 정책
- 네이티브 앱은 HTTP 클라이언트를 직접 사용
- **결론**: 모바일 앱은 `CORS_ORIGINS` 설정 없이도 API 호출 가능

**CORS 설정이 필요한 경우**:
- 웹 대시보드 (관리자 페이지)
- Expo 웹 빌드 (브라우저에서 실행)
- Swagger UI 등 개발 도구

### 환경별 설정

| 환경 | NODE_ENV | CORS 동작 | CORS_ORIGINS 예시 |
|------|----------|-----------|------------------|
| **개발** | `development` | ✅ 모든 origin 허용 (`origin: true`) | 설정 불필요 (무시됨) |
| **프리뷰** | `preview` | 🔒 지정된 origin만 허용 | `https://preview.aido.kr,https://admin-preview.aido.kr` |
| **프로덕션** | `production` | 🔒 지정된 origin만 허용 | `https://aido.kr,https://www.aido.kr,https://admin.aido.kr` |

---

## 🚀 배포 플랫폼별 가이드

### Railway

```bash
# Railway CLI 사용
railway login
railway link
railway variables set NODE_ENV=production
railway variables set CORS_ORIGINS="https://aido.kr,https://admin.aido.kr"
# ... 기타 환경 변수
railway up
```

또는 Railway 대시보드에서 Variables 설정:
1. Project Settings > Variables
2. `.env.production.example` 내용 복사
3. 각 변수 추가

### Render

```yaml
# render.yaml
services:
  - type: web
    name: aido-api
    env: node
    buildCommand: pnpm install && pnpm build
    startCommand: pnpm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: CORS_ORIGINS
        value: https://aido.kr,https://admin.aido.kr
      # ... 기타 환경 변수
```

### Vercel

```bash
# Vercel CLI 사용
vercel env add NODE_ENV production
vercel env add CORS_ORIGINS "https://aido.kr,https://admin.aido.kr"
# ... 기타 환경 변수
vercel --prod
```

### AWS / Docker

```dockerfile
# Dockerfile
FROM node:22-alpine
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build
CMD ["pnpm", "start"]
```

```bash
# 환경 변수는 docker-compose.yml 또는 ECS Task Definition에서 설정
docker run -e NODE_ENV=production \
  -e CORS_ORIGINS="https://aido.kr,https://admin.aido.kr" \
  -p 8080:8080 aido-api
```

---

## 🔐 환경 변수 설정

### 필수 환경 변수

```bash
# App
NODE_ENV=production
PORT=8080

# Database
DATABASE_URL=postgresql://...

# JWT
JWT_SECRET=...
JWT_REFRESH_SECRET=...

# Security
CORS_ORIGINS=https://aido.kr,https://admin.aido.kr
```

### OAuth 환경 변수 (선택)

```bash
# Google
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://api.aido.kr/v1/auth/google/web-callback

# Apple
APPLE_TEAM_ID=...
APPLE_CLIENT_ID=com.aido.mobile.service
APPLE_KEY_ID=...
APPLE_PRIVATE_KEY=...
APPLE_CALLBACK_URL=https://api.aido.kr/v1/auth/apple/callback

# Kakao
KAKAO_CLIENT_ID=...
KAKAO_CLIENT_SECRET=...
KAKAO_CALLBACK_URL=https://api.aido.kr/v1/auth/kakao/web-callback

# Naver
NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...
NAVER_CALLBACK_URL=https://api.aido.kr/v1/auth/naver/web-callback
```

### 외부 서비스 (선택)

```bash
# Email
RESEND_API_KEY=...
EMAIL_FROM=noreply@aido.kr

# Redis (캐시)
REDIS_URL=redis://...
CACHE_TYPE=redis

# 모니터링
SENTRY_DSN=...

# AI
GOOGLE_GENERATIVE_AI_API_KEY=...
```

---

## ✅ 배포 전 체크리스트

### 1. 환경 변수 확인

- [ ] `NODE_ENV=production` 설정
- [ ] `DATABASE_URL` 프로덕션 DB 연결 문자열
- [ ] `JWT_SECRET`, `JWT_REFRESH_SECRET` 강력한 랜덤 값 (최소 32자)
- [ ] `CORS_ORIGINS` 웹 클라이언트 도메인만 포함
- [ ] OAuth 콜백 URL 프로덕션 도메인으로 변경
- [ ] 모든 API 키 프로덕션 값으로 교체

### 2. 데이터베이스 마이그레이션

```bash
# 프로덕션 DB에 마이그레이션 실행
pnpm prisma migrate deploy
```

### 3. 보안 체크

- [ ] HTTPS 설정 (Let's Encrypt, Cloudflare 등)
- [ ] Rate Limiting 활성화 (`THROTTLE_TTL`, `THROTTLE_LIMIT`)
- [ ] Helmet 활성화 (기본 활성화됨)
- [ ] 민감한 정보 환경 변수로 관리 (코드에 하드코딩 금지)

### 4. 모니터링 설정

- [ ] Sentry DSN 설정 (에러 트래킹)
- [ ] 로그 수집 설정 (CloudWatch, Datadog 등)
- [ ] Health Check 엔드포인트 확인 (`GET /health`)

### 5. 성능 최적화

- [ ] Redis 캐시 활성화 (`CACHE_TYPE=redis`)
- [ ] DB 인덱스 최적화
- [ ] Connection Pool 설정 확인

### 6. 배포 후 검증

```bash
# Health Check
curl https://api.aido.kr/health

# API 문서 (개발 환경만 노출)
curl https://api.aido.kr/api/docs  # 404 확인 (프로덕션에서는 비활성화)

# 모바일 앱에서 테스트
# - 로그인
# - API 호출
# - 에러 핸들링
```

---

## 🔧 CORS 트러블슈팅

### CORS 에러가 발생하는 경우

**1. 웹 클라이언트에서 발생**
```
Access to fetch at 'https://api.aido.kr/v1/auth/login' from origin
'https://admin.aido.kr' has been blocked by CORS policy
```

**해결**: `CORS_ORIGINS`에 웹 도메인 추가
```bash
CORS_ORIGINS=https://aido.kr,https://admin.aido.kr
```

**2. 모바일 앱에서 CORS 에러**

❌ **이런 경우는 발생하지 않음!**
- 네이티브 모바일 앱은 CORS 제약을 받지 않음
- 다른 문제일 가능성:
  - 네트워크 연결 문제
  - API 서버 다운
  - 잘못된 API URL
  - 인증 토큰 문제

---

## 📚 참고 자료

- [NestJS Production 가이드](https://docs.nestjs.com/techniques/performance)
- [Prisma Production 체크리스트](https://www.prisma.io/docs/guides/deployment/deployment-guides)
- [CORS MDN 문서](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
