# 운영 이미지 두 개(api·migrate)의 빌드 정의. CI(docker/bake-action)와 로컬(docker buildx bake)이 같이 쓴다.
# 로컬: TAG=$(git rev-parse HEAD) docker buildx bake   (apps/api/docs/deployment.md "수동 배포")

variable "TAG" {
  default = "local"
}

# CI만 gha를 준다. 로컬은 BuildKit 기본 캐시를 쓴다
variable "CACHE" {
  default = ""
}

group "default" {
  targets = ["api", "migrate"]
}

target "_image" {
  context    = "."
  dockerfile = "apps/api/Dockerfile"
  platforms  = ["linux/arm64"]
  pull       = true
  # 검사를 통과한 뒤에만 올리도록 로컬 Docker로만 내보낸다
  output = ["type=docker"]
  # 단일 아키 이미지를 plain manifest로 둔다. 출처 증명은 CI가 GitHub attestations에 따로 남긴다
  attest = ["type=provenance,disabled=true", "type=sbom,disabled=true"]
}

target "api" {
  inherits   = ["_image"]
  target     = "production"
  tags       = ["ghcr.io/aiddoo/aido-platform-api:${TAG}"]
  cache-from = CACHE == "gha" ? ["type=gha,scope=api"] : []
  cache-to   = CACHE == "gha" ? ["type=gha,scope=api,mode=max"] : []
}

target "migrate" {
  inherits   = ["_image"]
  target     = "migrate"
  tags       = ["ghcr.io/aiddoo/aido-platform-migrate:${TAG}"]
  cache-from = CACHE == "gha" ? ["type=gha,scope=migrate"] : []
  cache-to   = CACHE == "gha" ? ["type=gha,scope=migrate,mode=max"] : []
}
