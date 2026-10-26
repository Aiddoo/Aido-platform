#!/usr/bin/env bash
# 1.13.0 전체 화면 캡처 오케스트레이터. 로컬 Docker API + 로컬 빌드 앱 전용이다.
#
# 사용: capture.sh [--devices iphone17pro,iphonese,duo,android,fold,flip] [--roles free,premium]
#                  [--themes light,dark] [--skip-seed] [--build <빌드 설명>]
#
# 기기 × 계정(일반/프리미엄) × 테마(라이트/다크) × 언어(ko, iPhone 17 Pro만 en 추가)마다
#  1) 기기를 부팅하고 상태 표시줄(9:41, 배터리 100%)과 테마·언어를 맞춘다
#  2) .env.screens의 데모 계정·화면 ID를 MAESTRO_SHOT_* shell 변수로 올린다(비밀번호를 argv에 싣지 않는다)
#  3) 이 폴더를 maestro test로 돌리고 NN_*.png만
#     ~/Desktop/Aido-Screens-1.13.0/<기기>/<일반|프리미엄>/<라이트|다크>[/en]/ 로 복사한다
#  4) 프리미엄 실행은 새 계정의 초대 수락을 소비하므로 끝나면 demo-seed reset-newbie로 되돌린다
# iPhone Duo 펼침은 simctl로 바꿀 수 없어(DeviceHub 자세 슬라이더) 중간에 멈추고 Enter를 기다린다.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"

OUT_ROOT="${SCREENS_OUT:-$HOME/Desktop/Aido-Screens-1.13.0}"
APP_ID="com.aido.mobile"
QA_SCHEME="${QA_SCHEME:-aido-dev}"
QA_API_BASE_URL="${QA_API_BASE_URL:-http://localhost:8080}"
ANDROID_SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
EMULATOR="$ANDROID_SDK/emulator/emulator"
ADB="${ADB:-adb}"
SEED=(node --no-warnings "$HERE/scripts/demo-seed.ts")

devices="iphone17pro,iphonese,duo,android,fold"
roles="free,premium"
themes="light,dark"
skip_seed=0
build_label="${SCREENS_BUILD:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --devices) devices="$2"; shift 2 ;;
    --roles) roles="$2"; shift 2 ;;
    --themes) themes="$2"; shift 2 ;;
    --skip-seed) skip_seed=1; shift ;;
    --build) build_label="$2"; shift 2 ;;
    -h | --help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "알 수 없는 인자: $1" >&2; exit 2 ;;
  esac
done

log() { printf '\n[capture] %s\n' "$*"; }
warn() { printf '[capture] 경고: %s\n' "$*" >&2; }
has() { [[ ",$1," == *",$2,"* ]]; }

# ---------- 준비 ----------

# 로컬 대상 확인(demo-seed가 비로컬 API·DB면 여기서 멈춘다)
"${SEED[@]}" status all >/dev/null

if [[ "$skip_seed" -eq 0 ]]; then
  log "데모 데이터를 만들고 AI 단계(parse-todo·리포트·반복 제안)를 돌립니다"
  "${SEED[@]}" seed ko
  if has "$devices" iphone17pro; then
    "${SEED[@]}" seed en
  fi
fi

ENV_FILE="$HERE/.env.screens"
[[ -f "$ENV_FILE" ]] || { echo "$ENV_FILE 가 없습니다. --skip-seed 없이 다시 실행하세요." >&2; exit 1; }

env_value() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/'; }

ANDROID_SERIAL=""
started_ios=()
started_android=()
summary_lines=()
failures=0

cleanup() {
  for udid in "${started_ios[@]}"; do
    xcrun simctl status_bar "$udid" clear >/dev/null 2>&1 || true
    xcrun simctl shutdown "$udid" >/dev/null 2>&1 || true
  done
  for serial in "${started_android[@]}"; do
    "$ADB" -s "$serial" emu kill >/dev/null 2>&1 || true
  done
}
trap cleanup EXIT

# ---------- iOS ----------

ios_udid() {
  # 이름이 정확히 같은 사용 가능한 시뮬레이터. 없으면 SE 3세대만 만든다(iOS 27.1은 SE 3세대를 받지 않아 27.0 이하)
  local name="$1" udid
  udid="$(xcrun simctl list devices available -j | python3 -c '
import json, sys
name = sys.argv[1]
for runtime, devices in json.load(sys.stdin)["devices"].items():
    for device in devices:
        if device["name"] == name:
            print(device["udid"]); sys.exit(0)
' "$name")"
  if [[ -z "$udid" && "$name" == "iPhone SE (3rd generation)" ]]; then
    for runtime in iOS-27-0 iOS-26-5; do
      udid="$(xcrun simctl create "$name" com.apple.CoreSimulator.SimDeviceType.iPhone-SE-3rd-generation "com.apple.CoreSimulator.SimRuntime.$runtime" 2>/dev/null)" && break
    done
  fi
  [[ -n "$udid" ]] || { echo "시뮬레이터 '$name'을 찾지 못했습니다." >&2; return 1; }
  echo "$udid"
}

ios_boot() {
  local udid="$1"
  if ! xcrun simctl list devices | grep -q "$udid) (Booted)"; then
    xcrun simctl boot "$udid"
    started_ios+=("$udid")
  fi
  xcrun simctl bootstatus "$udid" -b >/dev/null
  xcrun simctl status_bar "$udid" override --time 9:41 --dataNetwork wifi --wifiMode active --wifiBars 3 \
    --cellularMode active --cellularBars 4 --operatorName '' --batteryState charged --batteryLevel 100
  if ! xcrun simctl get_app_container "$udid" "$APP_ID" >/dev/null 2>&1; then
    [[ -n "${SCREENS_IOS_APP:-}" ]] || { echo "$udid 에 앱이 없습니다. SCREENS_IOS_APP=<.app 경로>를 주세요." >&2; return 1; }
    xcrun simctl install "$udid" "$SCREENS_IOS_APP"
  fi
}

ios_theme() { xcrun simctl ui "$1" appearance "$2"; }

ios_locale() {
  # 언어를 바꾸면 SpringBoard·앱이 새 값을 읽도록 재부팅한다
  local udid="$1" locale="$2" lang region current
  if [[ "$locale" == "en" ]]; then lang="en"; region="en_US"; else lang="ko"; region="ko_KR"; fi
  current="$(xcrun simctl spawn "$udid" defaults read -g AppleLanguages 2>/dev/null | tr -d ' \n()"' | cut -d, -f1)"
  [[ "$current" == "$lang"* ]] && return 0
  xcrun simctl spawn "$udid" defaults write -g AppleLanguages -array "$lang"
  xcrun simctl spawn "$udid" defaults write -g AppleLocale -string "$region"
  xcrun simctl shutdown "$udid"
  xcrun simctl boot "$udid"
  ios_boot "$udid"
}

# ---------- Android ----------

android_serial_for() {
  local avd="$1" serial
  for serial in $("$ADB" devices | awk '/^emulator-[0-9]+\tdevice$/ {print $1}'); do
    if [[ "$("$ADB" -s "$serial" emu avd name 2>/dev/null | head -1 | tr -d '\r')" == "$avd" ]]; then
      echo "$serial"
      return 0
    fi
  done
  return 1
}

android_boot() {
  # 결과 serial은 전역 ANDROID_SERIAL에 둔다(직접 띄운 에뮬레이터를 끝에 끄려고 subshell로 부르지 않는다)
  local avd="$1" serial port
  if serial="$(android_serial_for "$avd")"; then
    ANDROID_SERIAL="$serial"
    return 0
  fi
  if "$ADB" devices | grep -q '^emulator-'; then
    # 이 Mac에서는 에뮬레이터 하나가 Hypervisor를 잡고 있으면 두 번째는 HVF 없이 떠서 부팅하지 못한다(qemu mprotect)
    if [[ "${SCREENS_STOP_OTHER_EMULATORS:-0}" == "1" ]]; then
      for other in $("$ADB" devices | awk '/^emulator-/ {print $1}'); do "$ADB" -s "$other" emu kill >/dev/null 2>&1 || true; done
      sleep 5
    else
      warn "다른 에뮬레이터가 켜져 있어 $avd 가 HVF 없이 떠 부팅이 멈출 수 있습니다. SCREENS_STOP_OTHER_EMULATORS=1 이면 먼저 끕니다."
    fi
  fi
  port=5560
  while "$ADB" devices | grep -q "emulator-$port"; do port=$((port + 2)); done
  nohup "$EMULATOR" -avd "$avd" -port "$port" -no-audio -no-boot-anim -no-snapshot-save >"/tmp/aido-screens-$avd.log" 2>&1 &
  serial="emulator-$port"
  started_android+=("$serial")
  "$ADB" -s "$serial" wait-for-device
  for _ in $(seq 1 90); do
    [[ "$("$ADB" -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]] && break
    sleep 5
  done
  [[ "$("$ADB" -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]] \
    || { echo "$avd 부팅 실패(로그: /tmp/aido-screens-$avd.log)" >&2; return 1; }
  ANDROID_SERIAL="$serial"
}

android_release() {
  # 이 스크립트가 띄운 에뮬레이터는 다음 AVD가 HVF를 받을 수 있게 바로 끈다
  local serial="$1" kept=()
  for item in "${started_android[@]}"; do
    if [[ "$item" == "$serial" ]]; then
      "$ADB" -s "$serial" emu kill >/dev/null 2>&1 || true
      sleep 5
    else
      kept+=("$item")
    fi
  done
  started_android=("${kept[@]}")
}

android_prepare() {
  local serial="$1"
  if ! "$ADB" -s "$serial" shell pm path "$APP_ID" >/dev/null 2>&1; then
    [[ -n "${SCREENS_ANDROID_APK:-}" ]] || { echo "$serial 에 앱이 없습니다. SCREENS_ANDROID_APK=<apk 경로>를 주세요." >&2; return 1; }
    "$ADB" -s "$serial" install -r "$SCREENS_ANDROID_APK" >/dev/null
  fi
  # 로컬 API(8080)와 Metro(8081, 개발 빌드일 때)를 에뮬레이터 localhost로 연결한다
  "$ADB" -s "$serial" reverse tcp:8080 tcp:8080 >/dev/null
  "$ADB" -s "$serial" reverse tcp:8081 tcp:8081 >/dev/null
  # SystemUI 데모 모드: 시계 9:41, 배터리 100%, 알림 아이콘 숨김
  "$ADB" -s "$serial" shell settings put global sysui_demo_allowed 1
  local demo=(am broadcast -a com.android.systemui.demo -e command)
  "$ADB" -s "$serial" shell "${demo[@]}" enter >/dev/null
  "$ADB" -s "$serial" shell "${demo[@]}" clock -e hhmm 0941 >/dev/null
  "$ADB" -s "$serial" shell "${demo[@]}" battery -e level 100 -e plugged false >/dev/null
  "$ADB" -s "$serial" shell "${demo[@]}" network -e wifi show -e level 4 -e mobile show -e datatype none -e level 4 >/dev/null
  "$ADB" -s "$serial" shell "${demo[@]}" notifications -e visible false >/dev/null
}

android_theme() {
  local mode=no
  [[ "$2" == "dark" ]] && mode=yes
  "$ADB" -s "$1" shell cmd uimode night "$mode" >/dev/null
}

android_posture() {
  # 7.6" Fold-in AVD는 콘솔 명령으로 접고 편다. 결과는 화면 크기로 확인한다
  local serial="$1" posture="$2"
  "$ADB" -s "$serial" emu "$posture" >/dev/null
  sleep 3
  log "$serial $posture → $("$ADB" -s "$serial" shell wm size | tr -d '\r' | tail -1)"
}

# ---------- 실행 ----------

run_matrix() {
  # run_matrix <maestro 기기 id> <기기 폴더 이름> <ios|android> <언어 목록>
  local device_id="$1" device_dir="$2" platform="$3" locales="$4"
  local locale role theme role_dir theme_dir dest tmp key

  for locale in ${locales//,/ }; do
    [[ "$platform" == "ios" ]] && ios_locale "$device_id" "$locale"
    for role in ${roles//,/ }; do
      for theme in ${themes//,/ }; do
        role_dir="일반"; [[ "$role" == "premium" ]] && role_dir="프리미엄"
        theme_dir="라이트"; [[ "$theme" == "dark" ]] && theme_dir="다크"
        dest="$OUT_ROOT/$device_dir/$role_dir/$theme_dir"
        [[ "$locale" != "ko" ]] && dest="$dest/$locale"
        if [[ "$platform" == "ios" ]]; then ios_theme "$device_id" "$theme"; else android_theme "$device_id" "$theme"; fi

        log "$device_dir / $role_dir / $theme_dir / $locale"
        tmp="$(mktemp -d "${TMPDIR:-/tmp}/aido-screens.XXXXXX")"
        local upper role_upper
        upper="$(echo "$locale" | tr "[:lower:]" "[:upper:]")"
        role_upper="$(echo "$role" | tr "[:lower:]" "[:upper:]")"
        # 값이 없으면 빈 문자열로 두고 그 값을 쓰는 flow만 실패하게 한다
        # shellcheck disable=SC2155
        (
          # 비밀번호는 argv가 아닌 shell 변수로만 maestro에 넘긴다(Maestro가 MAESTRO_ 접두 변수를 flow 변수로 읽는다)
          export MAESTRO_SHOT_ROLE="$role" MAESTRO_SHOT_LOCALE="$locale"
          export MAESTRO_SHOT_EMAIL="$(env_value "SCREENS_${upper}_${role_upper}_EMAIL")"
          export MAESTRO_SHOT_PASSWORD="$(env_value "SCREENS_${upper}_${role_upper}_PASSWORD")"
          export MAESTRO_SHOT_GRANT_EMAIL="$(env_value "SCREENS_${upper}_GRANT_EMAIL")"
          export MAESTRO_SHOT_GRANT_PASSWORD="$(env_value "SCREENS_${upper}_GRANT_PASSWORD")"
          export MAESTRO_SHOT_NEWBIE_EMAIL="$(env_value "SCREENS_${upper}_NEWBIE_EMAIL")"
          export MAESTRO_SHOT_NEWBIE_PASSWORD="$(env_value "SCREENS_${upper}_NEWBIE_PASSWORD")"
          for key in TODO_ID CHECKLIST_TODO_ID RECURRING_TODO_ID RECURRING_DATE MEMO_ID NUDGE_ID FRIEND_ID; do
            export "MAESTRO_SHOT_$key=$(env_value "SCREENS_${upper}_${role_upper}_$key")"
          done
          export MAESTRO_SHOT_WEEKLY_REPORT_ID="$(env_value "SCREENS_${upper}_WEEKLY_REPORT_ID")"
          export MAESTRO_SHOT_MONTHLY_REPORT_ID="$(env_value "SCREENS_${upper}_MONTHLY_REPORT_ID")"
          export MAESTRO_SHOT_INVITE_CODE="$(env_value "SCREENS_${upper}_INVITE_CODE")"
          export MAESTRO_SHOT_STRANGER_NAME="$(env_value "SCREENS_${upper}_STRANGER_NAME")"
          export MAESTRO_SHOT_TODAY="$(env_value SCREENS_TODAY)" MAESTRO_SHOT_YESTERDAY="$(env_value SCREENS_YESTERDAY)"
          maestro --device "$device_id" test --include-tags "$role" --test-output-dir "$tmp" \
            -e "QA_SCHEME=$QA_SCHEME" -e "QA_API_BASE_URL=$QA_API_BASE_URL" "$HERE"
        ) || { failures=$((failures + 1)); warn "일부 flow 실패: $device_dir/$role_dir/$theme_dir/$locale (결과 $tmp)"; }

        mkdir -p "$dest"
        find "$tmp" -type f -name '[0-9][0-9]_*.png' -exec cp {} "$dest/" \;
        local count
        count="$(find "$dest" -maxdepth 1 -name '*.png' | wc -l | tr -d ' ')"
        summary_lines+=("| $device_dir | $role_dir | $theme_dir | $locale | $count |")
        if [[ "$role" == "premium" ]]; then
          "${SEED[@]}" reset-newbie "$locale" >/dev/null
        fi
      done
    done
  done
  [[ "$platform" == "ios" ]] && ios_locale "$device_id" ko
  return 0
}

check_duo_unfolded() {
  # 펼친 Duo 안쪽 화면은 2007px 폭이다. 접힌 바깥 화면(1398px)으로 찍혔으면 알린다
  local file width
  file="$(find "$OUT_ROOT/iPhone Duo 펼침" -name '*.png' 2>/dev/null | head -1)"
  [[ -n "$file" ]] || return 0
  width="$(sips -g pixelWidth "$file" | awk '/pixelWidth/ {print $2}')"
  [[ "$width" -ge 2000 ]] || warn "Duo 펼침 결과 폭이 ${width}px입니다. 펼친 자세가 아니었을 수 있습니다."
}

mkdir -p "$OUT_ROOT"

for device in ${devices//,/ }; do
  case "$device" in
    iphone17pro)
      udid="$(ios_udid 'iPhone 17 Pro')"; ios_boot "$udid"
      run_matrix "$udid" "iPhone 17 Pro" ios "ko,en" ;;
    iphonese)
      udid="$(ios_udid 'iPhone SE (3rd generation)')"; ios_boot "$udid"
      run_matrix "$udid" "iPhone SE 3" ios "ko" ;;
    duo)
      udid="$(ios_udid 'iPhone Duo')"; ios_boot "$udid"
      log "iPhone Duo는 접힌 자세로 부팅합니다(바깥 화면). 접힘 캡처를 시작합니다."
      run_matrix "$udid" "iPhone Duo 접힘" ios "ko"
      if [[ "${SCREENS_DUO_UNFOLDED:-ask}" == "skip" ]]; then
        warn "SCREENS_DUO_UNFOLDED=skip 이라 Duo 펼침을 건너뜁니다."
      else
        # simctl에는 접힘 제어가 없다. Xcode DeviceHub 기기 창의 자세(Poses) 막대에서 'Open Flat'으로 펼친다
        log "DeviceHub에서 iPhone Duo를 펼친 뒤(자세: 완전히 펼침) Enter를 누르세요."
        open -a "/Applications/Xcode.app/Contents/Applications/DeviceHub.app" || true
        read -r -p "[capture] 펼쳤으면 Enter: " _
        run_matrix "$udid" "iPhone Duo 펼침" ios "ko"
        check_duo_unfolded
      fi ;;
    android)
      android_boot Medium_Phone_API_36.1; serial="$ANDROID_SERIAL"; android_prepare "$serial"
      run_matrix "$serial" "Android 폰" android "ko"
      android_release "$serial" ;;
    fold)
      android_boot Aido_Fold_7.6_API_36.1; serial="$ANDROID_SERIAL"; android_prepare "$serial"
      android_posture "$serial" fold
      run_matrix "$serial" "Android 폴드 접힘" android "ko"
      android_posture "$serial" unfold
      run_matrix "$serial" "Android 폴드 펼침" android "ko"
      android_release "$serial" ;;
    flip)
      android_boot Aido_Flip_6.7_API_36.1; serial="$ANDROID_SERIAL"; android_prepare "$serial"
      android_posture "$serial" unfold
      run_matrix "$serial" "Android 플립" android "ko"
      android_release "$serial" ;;
    *) warn "알 수 없는 기기: $device" ;;
  esac
done

# ---------- 목차 ----------

app_version="$(node -p "require('$HERE/../../package.json').version")"
git_sha="$(git -C "$HERE" rev-parse --short HEAD)"
{
  echo "# Aido 1.13.0 화면 모음"
  echo
  echo "- 캡처: $(date '+%Y-%m-%d %H:%M %Z')"
  echo "- 앱 버전: $app_version (package.json) · 빌드: ${build_label:-미기재} · 커밋: $git_sha"
  echo "- 데이터: 로컬 데모 계정(scripts/demo-seed.ts). 상태 표시줄 9:41·배터리 100%"
  echo "- 파일 이름: NN_화면명.png. 번호와 화면은 저장소의 apps/mobile/maestro/screenshots-1.13.0/SCREENS.md와 같다"
  echo
  echo "## 폴더"
  echo
  echo "\`<기기>/<일반|프리미엄>/<라이트|다크>[/en]/\`. 일반은 무료 계정(친구 5명 한도·AI 횟수 소진·페이월),"
  echo "프리미엄은 스토어 구독 + 초대 보상을 쌓아 둔 계정이며 초대 보상 전용 계정(80~81)과 새 계정의 초대 수락(85~86)을 포함한다."
  echo "로그아웃 화면(01~04)과 빈 화면(90~95)은 일반 폴더에만 있다. en은 iPhone 17 Pro에만 있다."
  echo
  echo "| 기기 | 계정 | 테마 | 언어 | 장수 |"
  echo "| --- | --- | --- | --- | --- |"
  printf '%s\n' "${summary_lines[@]}"
  echo
  echo "## AI로 만든 화면"
  echo
  for locale in KO EN; do
    echo "- $locale: parse-todo $(env_value "SCREENS_${locale}_AI_PARSE_TODO" || true)," \
      "주간 리포트 $(env_value "SCREENS_${locale}_WEEKLY_REPORT_SOURCE" || true)," \
      "월간 리포트 $(env_value "SCREENS_${locale}_MONTHLY_REPORT_SOURCE" || true)," \
      "반복 제안 $(env_value "SCREENS_${locale}_SUGGESTIONS_SOURCE" || true) (ai=실제 생성, fallback-*=대체)"
  done
  echo "- 메모 AI 분석 결과(23)는 캡처 중 실제 parse-memo 호출로 만든다."
} >"$OUT_ROOT/README.md"

log "완료: $OUT_ROOT (실패한 실행 $failures개)"
exit "$failures"
