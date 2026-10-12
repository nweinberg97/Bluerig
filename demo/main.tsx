// Bluerig demo: the real screens from the app, running in the browser with a
// made-up shop and a pretend backend. Nothing is sent anywhere.
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Site } from '../src/components/Site';
import { EditorClient } from '../src/components/editor/EditorClient';
import { PromoteClient } from '../src/components/editor/PromoteClient';
import { installMockApi, SITE_URL } from './mock-api';
import { store } from './store';

installMockApi();

type Tab = 'editor' | 'site' | 'promote';
const TABS: [Tab, string][] = [
  ['editor', 'Edit my site'],
  ['site', 'Customer view'],
  ['promote', 'Flyers & posts'],
];
const ME = { id: 'me', email: 'owner@northline.example' };

function tabFromHash(): Tab {
  const h = location.hash.replace('#', '') as Tab;
  return TABS.some(([t]) => t === h) ? h : 'editor';
}

function App() {
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [, force] = useState(0);
  const [mountKey, setMountKey] = useState(0);
  useEffect(() => {
    const go = (t: Tab) => {
      setTab(t);
      setMountKey((k) => k + 1);
      try {
        history.replaceState(null, '', `#${t}`);
      } catch {
        /* fine */
      }
      window.scrollTo(0, 0);
    };
    const nav = (e: Event) => {
      const href = String((e as CustomEvent).detail);
      go(href.endsWith('/promote') ? 'promote' : 'editor');
    };
    const sw = (e: Event) => go((e as CustomEvent).detail as Tab);
    const upd = () => force((n) => n + 1);
    window.addEventListener('demo:navigate', nav);
    window.addEventListener('demo:tab', sw);
    window.addEventListener('demo:store', upd);
    return () => {
      window.removeEventListener('demo:navigate', nav);
      window.removeEventListener('demo:tab', sw);
      window.removeEventListener('demo:store', upd);
    };
  }, []);
  // window.open(siteUrl) from "See it" → show the customer's view instead.
  useEffect(() => {
    const orig = window.open;
    window.open = ((url?: string | URL) => {
      if (String(url ?? '').startsWith(SITE_URL)) {
        window.dispatchEvent(new CustomEvent('demo:tab', { detail: 'site' }));
        return null;
      }
      return orig.call(window, url);
    }) as typeof window.open;
    return () => {
      window.open = orig;
    };
  }, []);

  const s = store.get();
  const now = new Date();
  return (
    <>
      {tab === 'site' && (
        <main className="public">
          <Site profile={s.published} mode="live" now={now} businessId="demo" />
        </main>
      )}
      {tab === 'editor' && <EditorClient key={mountKey} id="demo" slug="northline" siteUrl={SITE_URL} previewUrl="#preview" live role="owner" me={ME} draft={s.draft} published={s.published} />}
      {tab === 'promote' && <PromoteClient key={mountKey} id="demo" profile={s.published} siteUrl={SITE_URL} live />}
      <nav className="demo-nav" aria-label="Demo screens">
        <span className="demo-tag">Demo</span>
        {TABS.map(([t, label]) => (
          <button key={t} aria-pressed={tab === t} onClick={() => window.dispatchEvent(new CustomEvent('demo:tab', { detail: t }))}>
            {label}
          </button>
        ))}
        <button className="demo-reset" onClick={() => { store.reset(); setMountKey((k) => k + 1); }} title="Start over">Reset</button>
      </nav>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
