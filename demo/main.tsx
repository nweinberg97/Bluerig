// Bluerig demo: the whole story in order, with the real screens from the app and
// a made-up shop. Nothing is sent anywhere.
//   1. Bluerig's landing page  2. You make a link  3. The owner opens it  4. The owner edits
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Landing } from '../src/components/landing/Landing';
import { PreviewExperience } from '../src/components/preview/PreviewExperience';
import { EditorClient } from '../src/components/editor/EditorClient';
import { PromoteClient } from '../src/components/editor/PromoteClient';
import { installMockApi, SITE_URL } from './mock-api';
import { store } from './store';
import { DemoClaim, MakeLink } from './screens';

installMockApi();

type Step = 'bluerig' | 'link' | 'owner' | 'editor' | 'promote';
const STEPS: [Step, string][] = [
  ['bluerig', 'Bluerig’s website'],
  ['link', 'You make a link'],
  ['owner', 'The owner opens it'],
  ['editor', 'The owner edits'],
];
const ME = { id: 'me', email: 'owner@northline.example' };

function fromHash(): Step {
  const h = location.hash.replace('#', '') as Step;
  return (['bluerig', 'link', 'owner', 'editor', 'promote'] as Step[]).includes(h) ? h : 'bluerig';
}

function App() {
  const [step, setStep] = useState<Step>(fromHash);
  const [mountKey, setMountKey] = useState(0);
  const [claimOpen, setClaimOpen] = useState(false);
  const [, force] = useState(0);
  const go = (s: Step) => {
    setStep(s);
    setMountKey((k) => k + 1);
    setClaimOpen(false);
    try {
      history.replaceState(null, '', `#${s}`);
    } catch {
      /* fine */
    }
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    const nav = (e: Event) => {
      const href = String((e as CustomEvent).detail);
      go(href.endsWith('/promote') ? 'promote' : 'editor');
    };
    const upd = () => force((n) => n + 1);
    window.addEventListener('demo:navigate', nav);
    window.addEventListener('demo:store', upd);
    return () => {
      window.removeEventListener('demo:navigate', nav);
      window.removeEventListener('demo:store', upd);
    };
  }, []);
  // "Open my live website" from the editor's menu → show it here instead.
  useEffect(() => {
    const orig = window.open;
    window.open = ((url?: string | URL) => (String(url ?? '').startsWith(SITE_URL) ? null : orig.call(window, url))) as typeof window.open;
    return () => {
      window.open = orig;
    };
  }, []);

  const s = store.get();
  const idx = STEPS.findIndex(([k]) => k === (step === 'promote' ? 'editor' : step));
  return (
    <>
      <div className="demo-steps" role="navigation" aria-label="Demo steps">
        <span className="demo-tag">Demo</span>
        <span className="demo-now">
          Step {idx + 1} of {STEPS.length}: <b>{STEPS[idx][1]}</b>
        </span>
        <span className="demo-pills">
          {STEPS.map(([k, label], i) => (
            <button key={k} aria-current={i === idx} onClick={() => go(k)}>
              {i + 1}. {label}
            </button>
          ))}
        </span>
        <span className="demo-arrows">
          <button disabled={idx === 0} onClick={() => go(STEPS[idx - 1][0])} aria-label="Previous step">‹</button>
          <button disabled={idx === STEPS.length - 1} onClick={() => go(STEPS[idx + 1][0])} aria-label="Next step">›</button>
        </span>
        <button className="demo-reset" onClick={() => { store.reset(); go('bluerig'); }}>Start over</button>
      </div>

      {step === 'bluerig' && (
        <Landing
          exampleHref="#link"
          onExample={() => go('link')}
          requestPreview={async () => {
            await new Promise((r) => setTimeout(r, 400));
            return null;
          }}
        />
      )}
      {step === 'link' && <MakeLink onOpen={() => go('owner')} />}
      {step === 'owner' && (
        <PreviewExperience
          profile={s.draft}
          ribbon={<span><b>Your new website</b>, made for Northline by Bluerig · <em>Preview, only you can see it</em></span>}
          barTitle="This is your new website."
          barText="Like it? Make changes and keep it."
          action={{ label: 'Edit my website', onClick: () => setClaimOpen(true) }}
          sheetOpen={claimOpen}
          onCloseSheet={() => setClaimOpen(false)}
          sheet={<DemoClaim phone={s.draft.phone} onDone={() => go('editor')} />}
        />
      )}
      {step === 'editor' && (
        <EditorClient key={mountKey} id="demo" slug="northline" siteUrl={SITE_URL} previewUrl="#owner" live={!!s.published} role="owner" me={ME} draft={s.draft} published={s.published} />
      )}
      {step === 'promote' && <PromoteClient key={mountKey} id="demo" profile={s.published ?? s.draft} siteUrl={SITE_URL} live={!!s.published} />}
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
