'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BusinessProfile, ProfileKey } from '@/lib/profile';
import { changedKeys } from '@/lib/profile';
import type { Confirmation } from '@/lib/checks';
import { browserClient } from '@/lib/supabase/browser';

export interface Person {
  key: string;
  name: string;
  color: string;
  field?: string | null;
}
const COLORS = ['#4FD1A0', '#B9A2F0', '#F29E8E', '#FFC266', '#7CC4FF'];

export type PublishResult = { ok: true } | { ok: false; error: string; confirm?: Confirmation[] };

/**
 * The editor's state: the draft (saved field by field as people type), the live
 * version, who else is here, and publishing.
 */
export function useDraft(id: string, initial: { draft: BusinessProfile; published: BusinessProfile | null }, me: { id: string; email: string | null }) {
  const [draft, setDraft] = useState(initial.draft);
  const [published, setPublished] = useState(initial.published);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const focused = useRef<string | null>(null);
  const channel = useRef<ReturnType<ReturnType<typeof browserClient>['channel']> | null>(null);

  const send = useCallback(
    async (path: string[], value: unknown) => {
      setPending((n) => n + 1);
      try {
        const r = await fetch(`/api/businesses/${id}/draft`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, value }) });
        if (!r.ok) setError((await r.json().catch(() => ({}))).error ?? 'Couldn’t save.');
        else setError('');
      } catch {
        setError('You’re offline. Changes will save when you reconnect.');
      } finally {
        setPending((n) => n - 1);
      }
    },
    [id],
  );

  /** Save a whole top-level field (panels). Updates the screen right away. */
  const setField = useCallback(
    <K extends ProfileKey>(key: K, value: BusinessProfile[K]) => {
      setDraft((d) => ({ ...d, [key]: value }));
      return send([key], value);
    },
    [send],
  );

  /**
   * Save a nested text value while someone types. Doesn't re-render (so the caret
   * stays put); commit() on blur puts it into state.
   */
  const typeAt = useCallback(
    (path: string[], value: string) => {
      const k = path.join('.');
      clearTimeout(timers.current.get(k));
      timers.current.set(
        k,
        setTimeout(() => {
          timers.current.delete(k);
          void send(path, value);
        }, 450),
      );
    },
    [send],
  );
  const commit = useCallback((path: string[], value: string) => {
    setDraft((d) => setIn(d, path, value));
  }, []);

  const setFocus = useCallback((field: string | null) => {
    focused.current = field;
    void channel.current?.track({ name: me.email?.split('@')[0] ?? 'Someone', field });
  }, [me.email]);

  // Live updates from teammates + who's here.
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const sb = browserClient();
    const ch = sb.channel(`biz:${id}`, { config: { presence: { key: me.id } } });
    ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'businesses', filter: `id=eq.${id}` }, (payload) => {
      const row = payload.new as { draft: BusinessProfile; published: BusinessProfile | null };
      setPublished(row.published);
      setDraft((mine) => {
        // Keep what I'm typing; take everything else from the server.
        const f = focused.current;
        if (!f) return row.draft;
        const path = f.split('.');
        const val = getIn(mine, path);
        return typeof val === 'string' ? setIn(row.draft, path, val) : row.draft;
      });
    });
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<{ name: string; field?: string | null }>();
      const list: Person[] = Object.entries(state)
        .filter(([key]) => key !== me.id)
        .map(([key, metas], i) => ({ key, name: metas[0]?.name ?? 'Someone', field: metas[0]?.field ?? null, color: COLORS[i % COLORS.length] }));
      setPeople(list);
    });
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') void ch.track({ name: me.email?.split('@')[0] ?? 'Someone', field: null });
    });
    channel.current = ch;
    return () => {
      void sb.removeChannel(ch);
      channel.current = null;
    };
  }, [id, me.id, me.email]);

  // Flush typing before the tab closes.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (timers.current.size) e.preventDefault();
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  const publish = useCallback(
    async (opts: { only?: ProfileKey[]; confirmed?: string[] } = {}): Promise<PublishResult> => {
      // Make sure any typing has been saved first.
      for (const [k, t] of timers.current) {
        clearTimeout(t);
        timers.current.delete(k);
        const path = k.split('.');
        await send(path, getIn(draftRef.current, path));
      }
      const r = await fetch(`/api/businesses/${id}/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(opts) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setPublished(j.published);
        return { ok: true };
      }
      return { ok: false, error: j.error ?? 'Couldn’t update the website.', confirm: j.confirm };
    },
    [id, send],
  );

  const changes = useMemo(() => changedKeys(published, draft), [published, draft]);
  return { draft, published, setField, typeAt, commit, setFocus, publish, saving: pending > 0, error, people, changes, setDraft };
}

export function getIn(o: unknown, path: string[]): unknown {
  return path.reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), o);
}

export function setIn<T>(o: T, path: string[], value: unknown): T {
  if (!path.length) return value as T;
  const [k, ...rest] = path;
  if (Array.isArray(o)) {
    const copy = o.slice();
    copy[Number(k)] = setIn(copy[Number(k)], rest, value);
    return copy as T;
  }
  const obj = (o ?? {}) as Record<string, unknown>;
  return { ...obj, [k]: setIn(obj[k], rest, value) } as T;
}
