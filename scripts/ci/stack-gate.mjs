import { appendFileSync, readFileSync } from 'node:fs';

import { planPullRequestCI } from './stack-policy.mjs';

const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
let plan = { run: true, base: 'develop', reason: 'push-or-dispatch' };
let baseSha = '';
let headSha = process.env.GITHUB_SHA;
if (event.pull_request) {
  const repository = process.env.GITHUB_REPOSITORY;
  const apiRoot = `${process.env.GITHUB_API_URL}/repos/${repository}`;
  async function request(endpoint) {
    const response = await fetch(`${apiRoot}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2026-03-10',
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`GitHub metadata request failed: ${response.status}`);
    return response.json();
  }
  const current = await request(`/pulls/${event.pull_request.number}`);
  headSha = current.head.sha;
  if (current.head.sha !== event.pull_request.head.sha)
    throw new Error('The workflow head is stale; rerun for the current commit.');
  const openPulls = [];
  for (let page = 1; ; page++) {
    const pulls = await request(`/pulls?state=open&per_page=100&page=${page}`);
    openPulls.push(...pulls);
    if (pulls.length < 100) break;
  }
  plan = planPullRequestCI(current, openPulls, repository);
  if (plan.run) {
    const base = await request(`/branches/${encodeURIComponent(plan.base)}`);
    baseSha = base.commit.sha;
    if (plan.reason === 'cumulative-stack-tip') {
      const comparison = await request(`/compare/${baseSha}...${headSha}`);
      if (!['ahead', 'identical'].includes(comparison.status)) {
        throw new Error('Rebase the stack onto the current develop before cumulative checks.');
      }
    }
  }
  for (const ancestor of plan.ancestors) {
    const comparison = await request(`/compare/${ancestor}...${current.head.sha}`);
    if (!['ahead', 'identical'].includes(comparison.status)) {
      throw new Error('The CI tip does not include every stack ancestor commit.');
    }
  }
}
appendFileSync(
  process.env.GITHUB_OUTPUT,
  `run=${plan.run}\nbase=${plan.base}\nbase-sha=${baseSha}\nhead-sha=${headSha}\n`,
);
appendFileSync(
  process.env.GITHUB_STEP_SUMMARY,
  `CI policy: **${plan.reason}**. Heavy checks: **${plan.run ? 'run' : 'deferred'}**. Base: \`${plan.base}\` (\`${baseSha}\`). Head: \`${headSha}\`. Ancestors: ${plan.ancestors?.join(', ') || 'none'}.\n`,
);
