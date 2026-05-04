export function parseAgentJsonSteps(raw: string | null | undefined): Record<string, unknown>[] {
  if (raw == null || raw === "") return [];

  let s = raw.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i.exec(s);
  const inner = fence?.[1];
  if (inner != null) s = inner.trim();

  try {
    const one = JSON.parse(s);
    if (one && typeof one === "object" && !Array.isArray(one)) {
      return [one as Record<string, unknown>];
    }
  } catch {
  }

  const out: Record<string, unknown>[] = [];
  let i = 0;
  while (i < s.length) {
    while (i < s.length) {
      const ch = s[i];
      if (ch === undefined || !/\s/.test(ch)) break;
      i++;
    }
    if (i >= s.length || s[i] !== "{") break;

    let depth = 0;
    let inString = false;
    let escape = false;
    const start = i;
    let closed = false;

    for (; i < s.length; i++) {
      const c = s[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (inString) {
        if (c === "\\") escape = true;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') {
        inString = true;
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          const slice = s.slice(start, i + 1);
          try {
            const obj = JSON.parse(slice);
            if (obj && typeof obj === "object" && !Array.isArray(obj)) {
              out.push(obj as Record<string, unknown>);
            }
          } catch {
          }
          closed = true;
          i++;
          break;
        }
      }
    }

    if (!closed) break;
  }

  return out;
}
