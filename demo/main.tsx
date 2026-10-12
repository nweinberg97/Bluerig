// Bluerig demo: the real screens from the app, running in the browser with a
// made-up shop and a pretend backend. Nothing is sent anywhere.
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Site } from '../src/components/Site';
import { EditorClient } from '../src/components/editor/EditorClient';
import { QuickActions } from '../src/components/editor/QuickActions';
import { PromoteClient } from '../src/components/editor/PromoteClient';
import { installMockApi, SITE_URL } from './mock-api';
import { store } from './store';
import { importedProfile } from './data';

installMockApi();

type Tab = 'site' | 'editor' | 'phone' | 'promote' | 'preview';
const TABS: [Tab, string][] = [
  ['site', 'Customer’s view'],
  ['editor', 'Editor'],
  ['phone', 'Phone updates'],
  ['promote', 'Promote'],
  ['preview', 'From the importer'],
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
      go(href.endsWith('/quick') ? 'phone' : href.endsWith('/promote') ? 'promote' : href.startsWith('/edit') ? 'editor' : 'site');
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
      {tab === 'phone' && (
        <div className="demo-phone">
          <div className="demo-phone-frame">
            <QuickActions key={mountKey} id="demo" siteUrl={SITE_URL} live me={ME} draft={s.draft} published={s.published} />
          </div>
          <p className="demo-phone-note">This is the screen a tech opens on their phone. Each button updates the live site right away.</p>
        </div>
      )}
      {tab === 'promote' && <PromoteClient key={mountKey} id="demo" profile={s.published} siteUrl={SITE_URL} live />}
      {tab === 'preview' && (
        <main className="public">
          <div className="pv-banner">
            <div className="in">
              <span>
                <b>Private preview for Northline.</b> Built by pasting their old website into Bluerig’s admin page. Only people with the link can see it. 4 things to
                check are marked in yellow.
              </span>
              <button className="btn go" onClick={() => window.dispatchEvent(new CustomEvent('demo:tab', { detail: 'editor' }))}>This is my business</button>
            </div>
          </div>
          <Site profile={importedProfile(now)} mode="preview" now={now} />
        </main>
      )}
      <nav className="demo-nav" aria-label="Demo screens">
        <span className="demo-tag">Demo · made-up shop</span>
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
