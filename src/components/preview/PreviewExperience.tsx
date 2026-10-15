'use client';

// What a shop owner sees when they open the link we text them: their whole new
// website first, nothing in the way. One bar at the bottom says what this is and
// offers one next step.

import { useEffect, type ReactNode } from 'react';
import type { BusinessProfile } from '@/lib/profile';
import { Site } from '../Site';
import * as I from '../icons';

export interface PreviewProps {
  profile: BusinessProfile;
  /** Short line at the very top. */
  ribbon: ReactNode;
  barTitle: string;
  barText: string;
  action?: { label: string; onClick: () => void } | null;
  /** A step-by-step sheet (claiming) shown over the site. */
  sheet?: ReactNode;
  sheetOpen?: boolean;
  onCloseSheet?: () => void;
}

export function PreviewExperience({ profile, ribbon, barTitle, barText, action, sheet, sheetOpen, onCloseSheet }: PreviewProps) {
  useEffect(() => {
    if (!sheetOpen) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onCloseSheet?.();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [sheetOpen, onCloseSheet]);
  return (
    <div className="pvx">
      <div className="pvx-ribbon">{ribbon}</div>
      <Site profile={profile} mode="live" now={new Date()} />
      <div className="pvx-bar" role="region" aria-label="About this website">
        <div className="pvx-bar-text">
          <b>{barTitle}</b>
          <small>{barText}</small>
        </div>
        {action && (
          <button className="pvx-go" onClick={action.onClick}>
            {action.label}
            <span aria-hidden>→</span>
          </button>
        )}
      </div>
      {sheetOpen && sheet && (
        <>
          <div className="rp-bg" onClick={onCloseSheet} />
          <aside className="pvx-sheet" role="dialog" aria-modal="true" aria-label="Make it yours">
            <button className="x" onClick={onCloseSheet} aria-label="Close">
              <I.X />
            </button>
            {sheet}
          </aside>
        </>
      )}
    </div>
  );
}
