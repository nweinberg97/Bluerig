// Demo stand-in for the Supabase browser client: storage, history and a pretend
// teammate, all in memory.
import { store } from '../store';

type Handler = (...a: unknown[]) => void;

function channel() {
  const handlers: { presence?: Handler; change?: Handler } = {};
  let teammate: { name: string; field: string | null } | null = null;
  const ch = {
    on(type: string, _filter: unknown, cb: Handler) {
      if (type === 'presence') handlers.presence = cb;
      else handlers.change = cb;
      return ch;
    },
    subscribe(cb?: (s: string) => void) {
      cb?.('SUBSCRIBED');
      // A teammate shows up and starts editing the intro, like a shared doc.
      setTimeout(() => {
        teammate = { name: 'Sam', field: null };
        handlers.presence?.();
        setTimeout(() => {
          teammate = { name: 'Sam', field: 'copy.intro' };
          handlers.presence?.();
          setTimeout(() => {
            teammate = { name: 'Sam', field: null };
            handlers.presence?.();
          }, 7000);
        }, 2500);
      }, 4000);
      return ch;
    },
    presenceState() {
      return teammate ? { sam: [{ name: teammate.name, field: teammate.field }] } : {};
    },
    track: async () => 'ok',
  };
  return ch;
}

function query(table: string) {
  const q = {
    select: () => q,
    eq: () => q,
    order: () => q,
    limit: () => q,
    then(res: (v: { data: unknown[] }) => void) {
      res({ data: table === 'site_versions' ? store.get().versions.map((v) => ({ id: v.id, label: v.label, created_at: v.at })) : [] });
    },
  };
  return q;
}

const client = {
  channel,
  removeChannel: async () => 'ok',
  from: query,
  storage: {
    from: () => ({
      upload: async (path: string, blob: Blob) => {
        store.uploads.set(path, URL.createObjectURL(blob));
        return { error: null };
      },
      getPublicUrl: (path: string) => ({ data: { publicUrl: store.uploads.get(path) ?? '' } }),
    }),
  },
  auth: { signInWithOtp: async () => ({ error: null }) },
};

export function browserClient() {
  return client as never;
}
