/**
 * Swagger UI 커스텀 테마
 *
 * - 다크모드/라이트모드 지원 (시스템 설정 자동 감지)
 * - 수동 테마 토글 버튼
 * - HTTP 메서드별 색상 구분
 * - LocalStorage 저장으로 사용자 선호 유지
 */

export const swaggerCustomCss = `
  /* ============================================
   * CSS 변수 정의
   * ============================================ */

  :root {
    /* 라이트 모드 (기본) */
    --swagger-bg: #ffffff;
    --swagger-bg-secondary: #f8fafc;
    --swagger-bg-tertiary: #f1f5f9;
    --swagger-text: #1e293b;
    --swagger-text-secondary: #64748b;
    --swagger-text-muted: #94a3b8;
    --swagger-accent: #3b82f6;
    --swagger-accent-hover: #2563eb;
    --swagger-border: #e2e8f0;
    --swagger-border-light: #f1f5f9;
    --swagger-shadow: rgba(0, 0, 0, 0.1);

    /* HTTP 메서드 색상 */
    --swagger-get: #22c55e;
    --swagger-get-bg: #f0fdf4;
    --swagger-post: #3b82f6;
    --swagger-post-bg: #eff6ff;
    --swagger-put: #f59e0b;
    --swagger-put-bg: #fffbeb;
    --swagger-patch: #8b5cf6;
    --swagger-patch-bg: #f5f3ff;
    --swagger-delete: #ef4444;
    --swagger-delete-bg: #fef2f2;
  }

  /* 다크 모드 */
  [data-theme="dark"] {
    --swagger-bg: #0f172a;
    --swagger-bg-secondary: #1e293b;
    --swagger-bg-tertiary: #334155;
    --swagger-text: #f1f5f9;
    --swagger-text-secondary: #94a3b8;
    --swagger-text-muted: #64748b;
    --swagger-accent: #60a5fa;
    --swagger-accent-hover: #93c5fd;
    --swagger-border: #334155;
    --swagger-border-light: #1e293b;
    --swagger-shadow: rgba(0, 0, 0, 0.4);

    /* HTTP 메서드 색상 (다크 모드) */
    --swagger-get: #4ade80;
    --swagger-get-bg: #14532d;
    --swagger-post: #60a5fa;
    --swagger-post-bg: #1e3a5f;
    --swagger-put: #fbbf24;
    --swagger-put-bg: #451a03;
    --swagger-patch: #a78bfa;
    --swagger-patch-bg: #2e1065;
    --swagger-delete: #f87171;
    --swagger-delete-bg: #450a0a;
  }

  /* 시스템 설정 자동 감지 */
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --swagger-bg: #0f172a;
      --swagger-bg-secondary: #1e293b;
      --swagger-bg-tertiary: #334155;
      --swagger-text: #f1f5f9;
      --swagger-text-secondary: #94a3b8;
      --swagger-text-muted: #64748b;
      --swagger-accent: #60a5fa;
      --swagger-accent-hover: #93c5fd;
      --swagger-border: #334155;
      --swagger-border-light: #1e293b;
      --swagger-shadow: rgba(0, 0, 0, 0.4);

      --swagger-get: #4ade80;
      --swagger-get-bg: #14532d;
      --swagger-post: #60a5fa;
      --swagger-post-bg: #1e3a5f;
      --swagger-put: #fbbf24;
      --swagger-put-bg: #451a03;
      --swagger-patch: #a78bfa;
      --swagger-patch-bg: #2e1065;
      --swagger-delete: #f87171;
      --swagger-delete-bg: #450a0a;
    }
  }

  /* ============================================
   * 기본 스타일
   * ============================================ */

  body {
    background-color: var(--swagger-bg) !important;
    color: var(--swagger-text) !important;
  }

  .swagger-ui {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
  }

  .swagger-ui .wrapper {
    background-color: var(--swagger-bg) !important;
  }

  /* ============================================
   * 헤더 (Topbar)
   * ============================================ */

  .swagger-ui .topbar {
    background-color: var(--swagger-bg-secondary) !important;
    border-bottom: 1px solid var(--swagger-border) !important;
    padding: 12px 0 !important;
  }

  .swagger-ui .topbar .wrapper {
    background-color: transparent !important;
  }

  .swagger-ui .topbar a {
    max-width: none !important;
  }

  .swagger-ui .topbar .download-url-wrapper {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .swagger-ui .topbar .download-url-wrapper input {
    background-color: var(--swagger-bg) !important;
    border: 1px solid var(--swagger-border) !important;
    color: var(--swagger-text) !important;
    border-radius: 6px !important;
  }

  .swagger-ui .topbar .download-url-wrapper .download-url-button {
    background-color: var(--swagger-accent) !important;
    border-radius: 6px !important;
    font-weight: 600 !important;
  }

  /* ============================================
   * 정보 섹션
   * ============================================ */

  .swagger-ui .info {
    margin: 30px 0 !important;
  }

  .swagger-ui .info .title {
    color: var(--swagger-text) !important;
    font-weight: 700 !important;
  }

  .swagger-ui .info .description {
    color: var(--swagger-text-secondary) !important;
  }

  .swagger-ui .info .description p {
    color: var(--swagger-text-secondary) !important;
  }

  .swagger-ui .info a {
    color: var(--swagger-accent) !important;
  }

  .swagger-ui .info a:hover {
    color: var(--swagger-accent-hover) !important;
  }

  /* ============================================
   * 필터/검색
   * ============================================ */

  .swagger-ui .filter-container {
    background-color: var(--swagger-bg-secondary) !important;
    border-radius: 8px !important;
    margin: 20px 0 !important;
    padding: 12px !important;
  }

  .swagger-ui .filter-container input {
    background-color: var(--swagger-bg) !important;
    border: 1px solid var(--swagger-border) !important;
    color: var(--swagger-text) !important;
    border-radius: 6px !important;
    padding: 8px 12px !important;
  }

  .swagger-ui .filter-container input::placeholder {
    color: var(--swagger-text-muted) !important;
  }

  /* ============================================
   * 태그 그룹
   * ============================================ */

  .swagger-ui .opblock-tag-section {
    margin-bottom: 16px !important;
  }

  .swagger-ui .opblock-tag {
    background-color: var(--swagger-bg-secondary) !important;
    border: 1px solid var(--swagger-border) !important;
    border-radius: 8px !important;
    color: var(--swagger-text) !important;
    padding: 12px 16px !important;
    margin: 0 !important;
    transition: all 0.2s ease !important;
  }

  .swagger-ui .opblock-tag:hover {
    background-color: var(--swagger-bg-tertiary) !important;
  }

  .swagger-ui .opblock-tag small {
    color: var(--swagger-text-secondary) !important;
  }

  .swagger-ui .opblock-tag svg {
    fill: var(--swagger-text-secondary) !important;
  }

  /* ============================================
   * HTTP 메서드 블록
   * ============================================ */

  .swagger-ui .opblock {
    border-radius: 8px !important;
    margin: 8px 0 !important;
    border: none !important;
    box-shadow: 0 1px 3px var(--swagger-shadow) !important;
  }

  .swagger-ui .opblock .opblock-summary {
    border-radius: 8px !important;
    padding: 8px 16px !important;
  }

  .swagger-ui .opblock .opblock-summary-method {
    border-radius: 6px !important;
    font-weight: 700 !important;
    min-width: 80px !important;
    text-align: center !important;
    padding: 8px 0 !important;
  }

  .swagger-ui .opblock .opblock-summary-path {
    color: var(--swagger-text) !important;
    font-weight: 600 !important;
  }

  .swagger-ui .opblock .opblock-summary-description {
    color: var(--swagger-text-secondary) !important;
  }

  /* GET */
  .swagger-ui .opblock.opblock-get {
    background-color: var(--swagger-get-bg) !important;
    border-left: 4px solid var(--swagger-get) !important;
  }

  .swagger-ui .opblock.opblock-get .opblock-summary-method {
    background-color: var(--swagger-get) !important;
  }

  .swagger-ui .opblock.opblock-get .opblock-summary {
    border-color: var(--swagger-get) !important;
  }

  /* POST */
  .swagger-ui .opblock.opblock-post {
    background-color: var(--swagger-post-bg) !important;
    border-left: 4px solid var(--swagger-post) !important;
  }

  .swagger-ui .opblock.opblock-post .opblock-summary-method {
    background-color: var(--swagger-post) !important;
  }

  .swagger-ui .opblock.opblock-post .opblock-summary {
    border-color: var(--swagger-post) !important;
  }

  /* PUT */
  .swagger-ui .opblock.opblock-put {
    background-color: var(--swagger-put-bg) !important;
    border-left: 4px solid var(--swagger-put) !important;
  }

  .swagger-ui .opblock.opblock-put .opblock-summary-method {
    background-color: var(--swagger-put) !important;
  }

  .swagger-ui .opblock.opblock-put .opblock-summary {
    border-color: var(--swagger-put) !important;
  }

  /* PATCH */
  .swagger-ui .opblock.opblock-patch {
    background-color: var(--swagger-patch-bg) !important;
    border-left: 4px solid var(--swagger-patch) !important;
  }

  .swagger-ui .opblock.opblock-patch .opblock-summary-method {
    background-color: var(--swagger-patch) !important;
  }

  .swagger-ui .opblock.opblock-patch .opblock-summary {
    border-color: var(--swagger-patch) !important;
  }

  /* DELETE */
  .swagger-ui .opblock.opblock-delete {
    background-color: var(--swagger-delete-bg) !important;
    border-left: 4px solid var(--swagger-delete) !important;
  }

  .swagger-ui .opblock.opblock-delete .opblock-summary-method {
    background-color: var(--swagger-delete) !important;
  }

  .swagger-ui .opblock.opblock-delete .opblock-summary {
    border-color: var(--swagger-delete) !important;
  }

  /* ============================================
   * 오퍼레이션 상세 (펼침)
   * ============================================ */

  .swagger-ui .opblock-body {
    background-color: var(--swagger-bg) !important;
    padding: 16px !important;
  }

  /* opblock-body 내 pre 스타일은 Swagger 기본 유지 */

  .swagger-ui .opblock-description-wrapper {
    padding: 16px !important;
  }

  .swagger-ui .opblock-description-wrapper p {
    color: var(--swagger-text-secondary) !important;
  }

  .swagger-ui .opblock-section-header {
    background-color: var(--swagger-bg-secondary) !important;
    border-radius: 6px !important;
    padding: 8px 12px !important;
    margin: 8px 0 !important;
  }

  .swagger-ui .opblock-section-header h4 {
    color: var(--swagger-text) !important;
  }

  .swagger-ui .opblock-section-header label {
    color: var(--swagger-text-secondary) !important;
  }

  /* ============================================
   * 테이블
   * ============================================ */

  .swagger-ui table {
    background-color: var(--swagger-bg) !important;
  }

  .swagger-ui table thead tr th {
    background-color: var(--swagger-bg-secondary) !important;
    color: var(--swagger-text) !important;
    border-bottom: 1px solid var(--swagger-border) !important;
  }

  .swagger-ui table tbody tr td {
    background-color: var(--swagger-bg) !important;
    color: var(--swagger-text) !important;
    border-bottom: 1px solid var(--swagger-border-light) !important;
  }

  .swagger-ui .parameters-col_name {
    color: var(--swagger-text) !important;
  }

  .swagger-ui .parameters-col_description {
    color: var(--swagger-text-secondary) !important;
  }

  .swagger-ui .parameter__name {
    color: var(--swagger-text) !important;
  }

  .swagger-ui .parameter__type {
    color: var(--swagger-text-muted) !important;
  }

  .swagger-ui .parameter__in {
    color: var(--swagger-text-muted) !important;
  }

  /* ============================================
   * 입력 필드
   * ============================================ */

  .swagger-ui input[type="text"],
  .swagger-ui input[type="password"],
  .swagger-ui input[type="email"],
  .swagger-ui input[type="number"],
  .swagger-ui textarea,
  .swagger-ui select {
    background-color: var(--swagger-bg) !important;
    border: 1px solid var(--swagger-border) !important;
    color: var(--swagger-text) !important;
    border-radius: 6px !important;
    padding: 8px 12px !important;
  }

  .swagger-ui input:focus,
  .swagger-ui textarea:focus,
  .swagger-ui select:focus {
    border-color: var(--swagger-accent) !important;
    outline: none !important;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2) !important;
  }

  .swagger-ui textarea {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace !important;
  }

  /* ============================================
   * 버튼
   * ============================================ */

  .swagger-ui .btn {
    border-radius: 6px !important;
    font-weight: 600 !important;
    padding: 8px 16px !important;
    transition: all 0.2s ease !important;
  }

  .swagger-ui .btn.execute {
    background-color: var(--swagger-accent) !important;
    border-color: var(--swagger-accent) !important;
    color: white !important;
  }

  .swagger-ui .btn.execute:hover {
    background-color: var(--swagger-accent-hover) !important;
  }

  .swagger-ui .btn.cancel {
    background-color: transparent !important;
    border: 1px solid var(--swagger-border) !important;
    color: var(--swagger-text) !important;
  }

  .swagger-ui .btn.cancel:hover {
    background-color: var(--swagger-bg-secondary) !important;
  }

  .swagger-ui .btn.authorize {
    background-color: var(--swagger-accent) !important;
    border-color: var(--swagger-accent) !important;
    color: white !important;
  }

  .swagger-ui .btn.authorize:hover {
    background-color: var(--swagger-accent-hover) !important;
  }

  .swagger-ui .authorization__btn {
    fill: var(--swagger-text) !important;
  }

  .swagger-ui .authorization__btn.locked {
    fill: var(--swagger-get) !important;
  }

  .swagger-ui .authorization__btn.unlocked {
    fill: var(--swagger-text-muted) !important;
  }

  /* ============================================
   * 모달 (Authorization)
   * ============================================ */

  .swagger-ui .dialog-ux .modal-ux {
    background-color: var(--swagger-bg) !important;
    border: 1px solid var(--swagger-border) !important;
    border-radius: 12px !important;
    box-shadow: 0 20px 50px var(--swagger-shadow) !important;
  }

  .swagger-ui .dialog-ux .modal-ux-header {
    border-bottom: 1px solid var(--swagger-border) !important;
    padding: 16px 20px !important;
  }

  .swagger-ui .dialog-ux .modal-ux-header h3 {
    color: var(--swagger-text) !important;
  }

  .swagger-ui .dialog-ux .modal-ux-content {
    padding: 20px !important;
  }

  .swagger-ui .dialog-ux .modal-ux-content p {
    color: var(--swagger-text-secondary) !important;
  }

  .swagger-ui .dialog-ux .modal-ux-content label {
    color: var(--swagger-text) !important;
  }

  .swagger-ui .auth-container {
    border-bottom: 1px solid var(--swagger-border) !important;
    padding-bottom: 16px !important;
    margin-bottom: 16px !important;
  }

  /* ============================================
   * 응답 섹션
   * ============================================ */

  .swagger-ui .responses-wrapper {
    background-color: var(--swagger-bg) !important;
  }

  .swagger-ui .response {
    background-color: var(--swagger-bg) !important;
  }

  .swagger-ui .response .response-col_status {
    color: var(--swagger-text) !important;
  }

  .swagger-ui .response .response-col_description {
    color: var(--swagger-text-secondary) !important;
  }

  .swagger-ui .responses-inner {
    padding: 16px !important;
  }

  .swagger-ui .responses-table {
    background-color: var(--swagger-bg) !important;
  }

  /* ============================================
   * 코드 & JSON - Swagger 기본 스타일 유지
   * ============================================ */

  /* highlight-code, microlight, code 스타일은
     Swagger 기본 스타일을 그대로 사용 */

  /* ============================================
   * 모델 (Schema)
   * ============================================ */

  .swagger-ui .model-box {
    background-color: var(--swagger-bg-secondary) !important;
    border-radius: 8px !important;
    padding: 16px !important;
  }

  .swagger-ui .model {
    color: var(--swagger-text) !important;
  }

  .swagger-ui .model-title {
    color: var(--swagger-text) !important;
  }

  .swagger-ui .prop-type {
    color: var(--swagger-accent) !important;
  }

  .swagger-ui .prop-format {
    color: var(--swagger-text-muted) !important;
  }

  .swagger-ui section.models {
    border: 1px solid var(--swagger-border) !important;
    border-radius: 8px !important;
    background-color: var(--swagger-bg) !important;
  }

  .swagger-ui section.models h4 {
    color: var(--swagger-text) !important;
    border-bottom: 1px solid var(--swagger-border) !important;
    padding: 12px 16px !important;
    margin: 0 !important;
  }

  .swagger-ui section.models .model-container {
    background-color: var(--swagger-bg) !important;
    border-radius: 6px !important;
    margin: 8px !important;
  }

  /* ============================================
   * 서버 선택
   * ============================================ */

  .swagger-ui .servers-title {
    color: var(--swagger-text) !important;
  }

  .swagger-ui .servers > label {
    color: var(--swagger-text) !important;
  }

  .swagger-ui .servers > label select {
    background-color: var(--swagger-bg) !important;
    border: 1px solid var(--swagger-border) !important;
    color: var(--swagger-text) !important;
    border-radius: 6px !important;
    padding: 8px 12px !important;
  }

  /* ============================================
   * 마크다운 콘텐츠
   * ============================================ */

  .swagger-ui .markdown p,
  .swagger-ui .markdown li {
    color: var(--swagger-text-secondary) !important;
  }

  .swagger-ui .markdown h1,
  .swagger-ui .markdown h2,
  .swagger-ui .markdown h3,
  .swagger-ui .markdown h4,
  .swagger-ui .markdown h5,
  .swagger-ui .markdown h6 {
    color: var(--swagger-text) !important;
  }

  /* markdown 내 코드 스타일은 Swagger 기본 유지 */

  .swagger-ui .markdown table {
    border: 1px solid var(--swagger-border) !important;
    border-radius: 6px !important;
    overflow: hidden !important;
  }

  .swagger-ui .markdown table th {
    background-color: var(--swagger-bg-secondary) !important;
    color: var(--swagger-text) !important;
    border-bottom: 1px solid var(--swagger-border) !important;
  }

  .swagger-ui .markdown table td {
    border-bottom: 1px solid var(--swagger-border-light) !important;
    color: var(--swagger-text) !important;
  }

  /* ============================================
   * 로딩
   * ============================================ */

  .swagger-ui .loading-container {
    background-color: var(--swagger-bg) !important;
  }

  .swagger-ui .loading-container .loading:after {
    border-color: var(--swagger-accent) transparent transparent transparent !important;
  }

  /* ============================================
   * 요청 시간
   * ============================================ */

  .swagger-ui .response-col_duration {
    color: var(--swagger-text-muted) !important;
  }

  /* ============================================
   * 테마 토글 버튼
   * ============================================ */

  .theme-toggle-btn {
    position: fixed;
    top: 14px;
    right: 20px;
    z-index: 9999;
    background-color: var(--swagger-bg-secondary);
    border: 1px solid var(--swagger-border);
    border-radius: 8px;
    padding: 8px 12px;
    cursor: pointer;
    font-size: 18px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .theme-toggle-btn:hover {
    background-color: var(--swagger-bg-tertiary);
    transform: scale(1.05);
  }

  .theme-toggle-btn span {
    font-size: 12px;
    color: var(--swagger-text-secondary);
    font-weight: 500;
  }

  /* ============================================
   * 스크롤바
   * ============================================ */

  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: var(--swagger-bg-secondary);
  }

  ::-webkit-scrollbar-thumb {
    background: var(--swagger-border);
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: var(--swagger-text-muted);
  }
`;

export const swaggerCustomJs = `
  // Swagger UI 테마 토글 스크립트
  (function() {
    'use strict';

    const STORAGE_KEY = 'swagger-theme';

    // 시스템 다크모드 감지
    function getSystemTheme() {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    // 저장된 테마 또는 시스템 설정 가져오기
    function getSavedTheme() {
      return localStorage.getItem(STORAGE_KEY) || null;
    }

    // 현재 테마 적용
    function applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      updateToggleButton(theme);
    }

    // 테마 초기화
    function initTheme() {
      const savedTheme = getSavedTheme();
      if (savedTheme) {
        applyTheme(savedTheme);
      }
      // 저장된 테마가 없으면 CSS 미디어 쿼리가 처리
    }

    // 테마 토글
    function toggleTheme() {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const systemTheme = getSystemTheme();

      let newTheme;
      if (currentTheme) {
        // 명시적 테마가 있으면 반대로
        newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      } else {
        // 시스템 테마 반대로
        newTheme = systemTheme === 'dark' ? 'light' : 'dark';
      }

      localStorage.setItem(STORAGE_KEY, newTheme);
      applyTheme(newTheme);
    }

    // 토글 버튼 상태 업데이트
    function updateToggleButton(theme) {
      const btn = document.getElementById('theme-toggle');
      if (btn) {
        const isDark = theme === 'dark' || (!theme && getSystemTheme() === 'dark');
        btn.innerHTML = isDark
          ? '☀️ <span>Light</span>'
          : '🌙 <span>Dark</span>';
      }
    }

    // 토글 버튼 생성
    function createToggleButton() {
      const btn = document.createElement('button');
      btn.id = 'theme-toggle';
      btn.className = 'theme-toggle-btn';
      btn.setAttribute('aria-label', 'Toggle theme');
      btn.onclick = toggleTheme;

      const currentTheme = getSavedTheme() || getSystemTheme();
      btn.innerHTML = currentTheme === 'dark'
        ? '☀️ <span>Light</span>'
        : '🌙 <span>Dark</span>';

      document.body.appendChild(btn);
    }

    // 시스템 테마 변경 감지
    function watchSystemTheme() {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        // 저장된 테마가 없을 때만 시스템 테마 따라감
        if (!getSavedTheme()) {
          updateToggleButton(e.matches ? 'dark' : 'light');
        }
      });
    }

    // DOM 로드 후 초기화
    function init() {
      initTheme();
      createToggleButton();
      watchSystemTheme();
    }

    // DOMContentLoaded 또는 즉시 실행
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();
`;
