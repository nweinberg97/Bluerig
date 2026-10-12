// Optional language model for "type a change" and the website importer. Any
// OpenAI-compatible endpoint works (an open-weight model at a provider with no data
// retention, or your own server). Output is constrained to JSON and re-validated.
import 'server-only';

export function llmConfigured(): boolean {
  return !!(process.env.LLM_BASE_URL && process.env.LLM_MODEL);
}

export async function llmJson<T = unknown>(opts: { system: string; user: string; schema: Record<string, unknown>; name: string; timeoutMs?: number }): Promise<T | null> {
  if (!llmConfigured()) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 12000);
  try {
    const res = await fetch(`${process.env.LLM_BASE_URL!.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(process.env.LLM_API_KEY ? { Authorization: `Bearer ${process.env.LLM_API_KEY}` } : {}) },
      body: JSON.stringify({
        model: process.env.LLM_MODEL,
        temperature: 0,
        messages: [
          { role: 'system', content: opts.system },
          { role: 'user', content: opts.user },
        ],
        response_format: { type: 'json_schema', json_schema: { name: opts.name, strict: true, schema: opts.schema } },
      }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = j.choices?.[0]?.message?.content;
    return content ? (JSON.parse(content) as T) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
