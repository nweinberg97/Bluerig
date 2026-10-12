// Minimal robots.txt reader. We only fetch a handful of public pages, identify
// ourselves, and skip any site or path that asks crawlers to stay out.

export const USER_AGENT = 'BluerigBot/0.1 (+https://bluerig.ca/bot; builds a preview for the business owner)';
const AGENT_TOKEN = 'bluerigbot';

interface Group {
  agents: string[];
  rules: { allow: boolean; path: string }[];
}

export function parseRobots(txt: string): Group[] {
  const groups: Group[] = [];
  let cur: Group | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).trim().toLowerCase();
    const val = line.slice(i + 1).trim();
    if (key === 'user-agent') {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else if ((key === 'allow' || key === 'disallow') && cur) {
      if (val || key === 'allow') cur.rules.push({ allow: key === 'allow', path: val });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }
  return groups;
}

function toRegex(path: string): RegExp {
  const anchored = path.endsWith('$');
  const body = (anchored ? path.slice(0, -1) : path).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + body + (anchored ? '$' : ''));
}

/** Longest matching rule wins; allow wins a tie. No rules for us → allowed. */
export function isAllowed(robotsTxt: string | null, pathWithQuery: string): boolean {
  if (!robotsTxt) return true;
  const groups = parseRobots(robotsTxt);
  const ours = groups.filter((g) => g.agents.some((a) => a !== '*' && AGENT_TOKEN.includes(a)));
  const group = ours.length ? ours : groups.filter((g) => g.agents.includes('*'));
  const rules = group.flatMap((g) => g.rules).filter((r) => r.path);
  let best: { allow: boolean; len: number } | null = null;
  for (const r of rules) {
    if (toRegex(r.path).test(pathWithQuery)) {
      const len = r.path.length;
      if (!best || len > best.len || (len === best.len && r.allow)) best = { allow: r.allow, len };
    }
  }
  return best ? best.allow : true;
}
