const STACK_LABEL = 'stack:1.10.0';
const TIP_LABEL = 'ci:stack-tip';
const STACK_PREFIX = 'upgrade/1.10-';

const hasLabel = (pull, name) => pull.labels.some((label) => label.name === name);

export function planPullRequestCI(current, openPulls, repository) {
  const isStack = current.head.ref.startsWith(STACK_PREFIX) || hasLabel(current, STACK_LABEL);
  if (!isStack) {
    return {
      run: current.head.ref !== 'develop',
      base: current.base.ref,
      ancestors: [],
      reason: 'regular',
    };
  }
  if (!hasLabel(current, STACK_LABEL)) {
    return { run: false, base: 'develop', ancestors: [], reason: 'awaiting-stack-metadata' };
  }
  const members = openPulls.filter((pull) => hasLabel(pull, STACK_LABEL));
  const tips = members.filter((pull) => hasLabel(pull, TIP_LABEL));
  if (tips.length > 1) throw new Error('A stack must have exactly one CI tip.');
  if (!hasLabel(current, TIP_LABEL) || current.draft) {
    return { run: false, base: 'develop', ancestors: [], reason: 'intermediate-or-draft' };
  }
  if (tips.length !== 1 || tips[0].number !== current.number) {
    throw new Error('The current pull request must be the live stack tip.');
  }
  const byHead = new Map(members.map((pull) => [pull.head.ref, pull]));
  if (byHead.size !== members.length) throw new Error('Duplicate stack branches.');
  const ancestors = [];
  const visited = new Set();
  let pull = current;
  while (true) {
    if (visited.has(pull.number)) throw new Error('Circular stack dependency.');
    if (pull.head.repo?.full_name !== repository)
      throw new Error('Stack branches must belong to this repository.');
    visited.add(pull.number);
    if (pull.number !== current.number) ancestors.push(pull.head.sha);
    if (pull.base.ref === 'develop') break;
    pull = byHead.get(pull.base.ref);
    if (!pull) throw new Error('The stack must connect to develop without missing pull requests.');
  }
  if (visited.size !== members.length) throw new Error('Disconnected stack branches.');
  return { run: true, base: 'develop', ancestors, reason: 'cumulative-stack-tip' };
}
