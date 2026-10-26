// 설치된 Chrome을 DevTools 프로토콜로 띄워 HTML을 정확한 픽셀 크기로 캡처한다.
// Node 24 내장 WebSocket만 쓰므로 Playwright 같은 의존성이 필요 없다.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

function findChrome() {
  const found = CANDIDATES.find((path) => path != null && existsSync(path));
  if (found == null) {
    throw new Error(
      `Chrome을 찾지 못했어요. CHROME_PATH를 지정하세요 (찾아본 곳: ${CANDIDATES.filter(Boolean).join(', ')})`,
    );
  }
  return found;
}

async function waitForPort(profileDir) {
  const file = join(profileDir, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (existsSync(file)) {
      const [port] = readFileSync(file, 'utf8').split('\n');
      if (port) {
        return Number(port);
      }
    }
    await delay(100);
  }
  throw new Error('Chrome DevTools 포트를 열지 못했어요');
}

class Session {
  #socket;
  #nextId = 1;
  #pending = new Map();
  #listeners = new Set();

  constructor(socket) {
    this.#socket = socket;
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id != null && this.#pending.has(message.id)) {
        const { resolve, reject } = this.#pending.get(message.id);
        this.#pending.delete(message.id);
        if (message.error) {
          reject(new Error(`${message.error.message} ${message.error.data ?? ''}`));
        } else {
          resolve(message.result);
        }
        return;
      }
      for (const listener of this.#listeners) {
        listener(message);
      }
    });
  }

  send(method, params = {}) {
    const id = this.#nextId;
    this.#nextId += 1;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#socket.send(JSON.stringify({ id, method, params }));
    });
  }

  once(method) {
    return new Promise((resolve) => {
      const listener = (message) => {
        if (message.method === method) {
          this.#listeners.delete(listener);
          resolve(message.params);
        }
      };
      this.#listeners.add(listener);
    });
  }

  close() {
    this.#socket.close();
  }
}

export async function launchChrome() {
  const profileDir = mkdtempSync(join(tmpdir(), 'aido-store-art-'));
  const child = spawn(
    findChrome(),
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--allow-file-access-from-files',
      '--force-color-profile=srgb',
      '--hide-scrollbars',
      '--font-render-hinting=none',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const port = await waitForPort(profileDir);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find((target) => target.type === 'page');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  const session = new Session(socket);
  await session.send('Page.enable');
  await session.send('Runtime.enable');

  async function evaluate(expression) {
    const { result, exceptionDetails } = await session.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    }
    return result.value;
  }

  return {
    // url을 width×height(CSS px)로 열고 setup(job)을 실행한 뒤 scale배 PNG를 돌려준다.
    async render({ url, width, height, scale = 1, job }) {
      await session.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: scale,
        mobile: false,
      });
      const loaded = session.once('Page.loadEventFired');
      await session.send('Page.navigate', { url });
      await loaded;
      const report = await evaluate(`window.renderJob(${JSON.stringify(job)})`);
      const { data } = await session.send('Page.captureScreenshot', {
        format: 'png',
        clip: { x: 0, y: 0, width, height, scale: 1 },
        captureBeyondViewport: false,
        fromSurface: true,
      });
      return { png: Buffer.from(data, 'base64'), report };
    },
    async close() {
      session.close();
      child.kill();
      await delay(200);
      rmSync(profileDir, { recursive: true, force: true });
    },
  };
}

export const defaultCaptureRoot = join(homedir(), 'Desktop/Aido-Screens-1.13.0');
