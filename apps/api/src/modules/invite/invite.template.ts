import { Injectable } from "@nestjs/common";

import type { InviteUserPreview } from "./invite.service";

const APP_STORE_URL =
	"https://apps.apple.com/us/app/%EC%95%84%EC%9D%B4%EB%91%90-ai-%ED%88%AC%EB%91%90-%ED%94%8C%EB%9E%98%EB%84%88/id6757722325";
const PLAY_STORE_URL =
	"https://play.google.com/store/apps/details?id=com.aido.mobile";
const DEFAULT_OG_IMAGE = "https://api.aido.kr/assets/images/og-invite.png";

@Injectable()
export class InviteTemplateService {
	renderInvitePage(userTag: string, user: InviteUserPreview | null): string {
		const displayName = user?.name ?? "Aido \uC0AC\uC6A9\uC790";
		const ogImage = user?.profileImage ?? DEFAULT_OG_IMAGE;
		const deepLink = `aido://invite/${userTag}`;

		return /* html */ `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#ff6843" />
  <title>${this.#escapeHtml(displayName)} \uB2D8\uC774 \uC544\uC774\uB450\uB85C \uCD08\uB300\uD588\uC5B4\uC694!</title>

  <meta property="og:type" content="website" />
  <meta property="og:title" content="${this.#escapeHtml(displayName)} \uB2D8\uC774 \uC544\uC774\uB450\uB85C \uCD08\uB300\uD588\uC5B4\uC694!" />
  <meta property="og:description" content="\uCE5C\uAD6C\uC640 \uD568\uAED8 \uC131\uC7A5\uD558\uB294 \uD560 \uC77C \uAD00\uB9AC, \uC544\uC774\uB450\uC5D0\uC11C \uC2DC\uC791\uD558\uC138\uC694" />
  <meta property="og:image" content="${this.#escapeHtml(ogImage)}" />
  <meta property="og:url" content="https://aido.kr/invite/${userTag}" />

  <style>${this.#baseStyles()}</style>
</head>
<body>
  <div class="card">
    <img class="logo" src="https://aido.kr/logo.png" alt="Aido" />
    <h1 class="title">
      <span class="highlight">${this.#escapeHtml(displayName)}</span> \uB2D8\uC774<br/>\uC544\uC774\uB450\uB85C \uCD08\uB300\uD588\uC5B4\uC694
    </h1>
    <span class="tag">${userTag}</span>
    <p class="desc">
      \uCE5C\uAD6C\uC640 \uD568\uAED8 \uC131\uC7A5\uD558\uB294 \uD560 \uC77C \uAD00\uB9AC<br/>\uC544\uC774\uB450\uC5D0\uC11C \uC2DC\uC791\uD574 \uBCF4\uC138\uC694!
    </p>
    <a href="${deepLink}" class="btn btn-primary" id="open-app">\uC544\uC774\uB450\uC5D0\uC11C \uC5F4\uAE30</a>

    <div class="divider">
      <span class="divider-line"></span>
      <span class="divider-text">\uB610\uB294</span>
      <span class="divider-line"></span>
    </div>

    <a href="#" class="btn btn-secondary" id="download" style="display:none;">\uC544\uC774\uB450 \uB2E4\uC6B4\uB85C\uB4DC</a>
  </div>

  <p class="footer">
    <a href="https://www.aido.kr">\uC544\uC774\uB450</a> &mdash; AI \uD22C\uB450 \uD50C\uB798\uB108
  </p>

  <script>
    (function() {
      var deepLink = '${deepLink}';
      var appOpened = false;
      var isIOS = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
      var storeUrl = isIOS ? '${APP_STORE_URL}' : '${PLAY_STORE_URL}';

      document.getElementById('open-app').addEventListener('click', function(e) {
        e.preventDefault();
        window.location = deepLink;
        setTimeout(function() {
          if (!appOpened) {
            document.getElementById('download').style.display = 'block';
          }
        }, 1500);
      });

      document.getElementById('download').addEventListener('click', function(e) {
        e.preventDefault();
        window.location = storeUrl;
      });

      document.addEventListener('visibilitychange', function() {
        if (document.hidden) appOpened = true;
      });

      window.location = deepLink;
      setTimeout(function() {
        if (!appOpened) {
          document.getElementById('download').style.display = 'block';
        }
      }, 1500);
    })();
  </script>
</body>
</html>`;
	}

	renderErrorPage(): string {
		return /* html */ `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#ff6843" />
  <title>\uC544\uC774\uB450 - \uC798\uBABB\uB41C \uCD08\uB300 \uB9C1\uD06C</title>
  <style>${this.#baseStyles()}</style>
</head>
<body>
  <div class="card">
    <img class="logo" src="https://aido.kr/logo.png" alt="Aido" style="filter: grayscale(1) opacity(0.4) drop-shadow(2px 2px 0px var(--fg));" />
    <h1 class="title">\uC798\uBABB\uB41C \uCD08\uB300 \uB9C1\uD06C\uC608\uC694</h1>
    <p class="desc">\uB9C1\uD06C\uB97C \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694</p>
  </div>
  <p class="footer">
    <a href="https://www.aido.kr">\uC544\uC774\uB450</a> &mdash; AI \uD22C\uB450 \uD50C\uB798\uB108
  </p>
</body>
</html>`;
	}

	#baseStyles(): string {
		return `
    * { margin: 0; padding: 0; box-sizing: border-box; }

    @import url('https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@400;500;700&display=swap');

    :root {
      --bg: #fdfbf7;
      --fg: #2d2d2d;
      --brand: #ff6843;
      --brand-fg: #ffffff;
      --muted: #e5e0d8;
      --muted-fg: #7d7d7d;
    }

    body {
      font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: var(--bg);
      background-image: radial-gradient(var(--muted) 1px, transparent 1px);
      background-size: 24px 24px;
      color: var(--fg);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      min-height: 100dvh;
      padding: 24px 16px;
      -webkit-font-smoothing: antialiased;
      word-break: keep-all;
    }

    .card {
      background: #fff;
      border: 3px solid var(--fg);
      border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
      padding: 48px 32px 36px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 6px 6px 0px 0px var(--fg);
      transform: rotate(-0.5deg);
      position: relative;
    }

    .card::before {
      content: '';
      position: absolute;
      top: -12px;
      right: 24px;
      width: 48px;
      height: 24px;
      background: #fff9c4;
      border: 2px solid var(--fg);
      border-radius: 4px 4px 0 0;
      transform: rotate(3deg);
      z-index: 1;
    }

    .logo {
      width: 80px;
      height: 80px;
      margin-bottom: 20px;
      transform: rotate(3deg);
      filter: drop-shadow(2px 2px 0px var(--fg));
    }

    .title {
      font-family: 'Noto Sans KR', sans-serif;
      font-size: 22px;
      font-weight: 700;
      line-height: 1.5;
      margin-bottom: 16px;
      color: var(--fg);
    }

    .highlight {
      color: var(--brand);
      position: relative;
    }

    .tag {
      display: inline-block;
      background: #fdf1e3;
      color: var(--fg);
      padding: 6px 18px;
      border-radius: 120px 30px 100px 30px / 30px 100px 30px 120px;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 2px;
      margin-bottom: 20px;
      border: 2px solid var(--fg);
      box-shadow: 2px 2px 0px 0px var(--fg);
      transform: rotate(1deg);
    }

    .desc {
      font-size: 15px;
      color: var(--muted-fg);
      line-height: 1.7;
      margin-bottom: 28px;
    }

    .btn {
      display: block;
      width: 100%;
      padding: 16px 24px;
      border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
      font-family: 'Noto Sans KR', sans-serif;
      font-size: 16px;
      font-weight: 700;
      text-decoration: none;
      text-align: center;
      margin-bottom: 10px;
      border: 3px solid var(--fg);
      cursor: pointer;
      transition: all 0.1s ease;
    }

    .btn-primary {
      background: var(--brand);
      color: var(--brand-fg);
      box-shadow: 4px 4px 0px 0px var(--fg);
    }
    .btn-primary:hover {
      transform: translate(2px, 2px);
      box-shadow: 2px 2px 0px 0px var(--fg);
    }
    .btn-primary:active {
      transform: translate(4px, 4px);
      box-shadow: 0px 0px 0px 0px var(--fg);
    }

    .btn-secondary {
      background: #fff;
      color: var(--fg);
      box-shadow: 4px 4px 0px 0px var(--fg);
    }
    .btn-secondary:hover {
      transform: translate(2px, 2px);
      box-shadow: 2px 2px 0px 0px var(--fg);
    }
    .btn-secondary:active {
      transform: translate(4px, 4px);
      box-shadow: 0px 0px 0px 0px var(--fg);
    }

    .divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 4px 0 14px;
    }
    .divider-line {
      flex: 1;
      height: 0;
      border-top: 2px dashed var(--muted);
    }
    .divider-text {
      font-size: 12px;
      color: var(--muted-fg);
      font-weight: 500;
    }

    .footer {
      margin-top: 28px;
      font-size: 13px;
      color: var(--muted-fg);
    }

    .footer a {
      color: var(--brand);
      text-decoration: none;
      font-weight: 700;
      border-bottom: 2px solid var(--brand);
      padding-bottom: 1px;
    }

    @media (max-width: 420px) {
      .card { padding: 36px 20px 28px; }
      .title { font-size: 20px; }
      .logo { width: 64px; height: 64px; }
    }`;
	}

	#escapeHtml(str: string): string {
		return str
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}
}
