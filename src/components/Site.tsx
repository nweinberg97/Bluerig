// The shop's website. One component renders the live site, the private preview and
// the editor canvas, so what owners edit is exactly what customers see. In edit mode,
// words carry data-k (inline editing) and blocks carry data-panel (opens a quick panel);
// the editor handles both by event delegation, so this file stays render-only.

import type { CSSProperties, ReactNode } from 'react';
import type { BusinessProfile, ConfirmKey } from '@/lib/profile';
import { DAYS, formatPrice, isPostalArea, LIMITS } from '@/lib/profile';
import { FULL, dayOf, fmtDate, fmtHour, fmtRange, isAvailabilityLive, isSpecialLive, localDate, todayLine, upcomingOverrides } from '@/lib/time';
import { mix, siteVars } from '@/lib/colour';
import type { GoogleReviews } from '@/lib/reviews';
import { LeadForm } from './LeadForm';
import * as I from './icons';

export type SiteMode = 'live' | 'preview' | 'edit';

export interface SiteProps {
  profile: BusinessProfile;
  mode: SiteMode;
  now: Date;
  businessId?: string;
  reviews?: GoogleReviews | null;
  reviewLink?: string | null;
}

export const telHref = (phone: string) => `tel:+1${phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')}`;

export function Site({ profile: p, mode, now, businessId, reviews, reviewLink }: SiteProps) {
  const ed = mode === 'edit';
  const flagged = (k: ConfirmKey) => mode !== 'live' && !!p.confirm[k];
  const edAttrs = (panel: string, extra?: string) => edAttrsFor(ed, panel, extra);
  const today = localDate(now, p.timezone);
  const specialOn = isSpecialLive(p, now);
  const statusOn = isAvailabilityLive(p, now);
  const name = [p.brand.name, p.brand.tagline].filter(Boolean).join(' ');
  const line = todayLine(p, now);
  const c = p.copy;

  const trust: ReactNode[] = [];
  if (p.facts.familyOwned) trust.push(<><I.Home />Family-owned and operated</>);
  if (p.facts.yearFounded) trust.push(<><I.Cal />In business since {p.facts.yearFounded}</>);
  for (const a of p.facts.awards) trust.push(<><I.Award />{a}</>);
  if (p.facts.licensedInsured) trust.push(<><I.Check />Licensed &amp; insured</>);
  if (p.facts.emergency247) trust.push(<><I.Pulse />24/7 emergency service</>);

  const towns = p.towns.filter((t) => !isPostalArea(t));
  const postal = p.towns.filter(isPostalArea);
  const jobs = [...p.jobs].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6);
  const hasHeatPump = p.services.some((s) => /heat pump/i.test(s.name));
  const showReviews = !!(reviews && reviews.reviews.length) || ed;
  const style = { ...siteVars(p.brand), '--gl': mix(p.brand.primary, '#FFFFFF', 0.45) } as CSSProperties;

  return (
    <div className={`site ${ed ? 'editing' : ''}`} style={style}>
      {/* Emergency / booked: the most important line on the page when it's on */}
      {statusOn && p.availability.kind === 'emergency' && (
        <a className={`alert em ${ed ? 'ed' : ''}`} href={ed || !p.phone ? undefined : telHref(p.phone)} {...edAttrs('status')}>
          <div className="w">
            <i className="dot" />
            <b>Taking emergency calls right now</b>
            {p.phone && <span className="go">Tap to call {p.phone}</span>}
          </div>
          <EdTag ed={ed}>Change</EdTag>
        </a>
      )}
      {statusOn && p.availability.kind === 'booked' && (
        <div className={`alert bk ${ed ? 'ed' : ''}`} {...edAttrs('status')}>
          <div className="w">
            <i className="dot" />
            <b>Booked up this week.</b>
            <span>Call to get on the list for the next opening.</span>
          </div>
          <EdTag ed={ed}>Change</EdTag>
        </div>
      )}
      {/* In edit mode, optional parts of the page show a slim "add" strip where they'd go. */}
      {ed && !statusOn && (
        <button type="button" className="addline em" data-panel="status">
          <I.Siren />
          <span><b>Emergency calls: off.</b> Tap to show a red “Call now” bar at the top of your website.</span>
        </button>
      )}
      {ed && !p.special && (
        <button type="button" className="addline" data-panel="special">
          <I.Tag />
          <span><b>Add a deal</b> (optional), like $50 off a tune-up. It takes itself down after the last day.</span>
        </button>
      )}
      {p.special && (specialOn || ed) && (
        <div className={`special ${ed ? 'ed' : ''}`} {...edAttrs('special')} style={specialOn ? undefined : { opacity: 0.55 }}>
          <div className="w">
            <span className="tag">{specialOn ? 'Deal' : 'Ended'}</span>
            <span>{p.special.title}</span>
            {p.special.detail && <span className="sub">{p.special.detail}</span>}
            <span className="until">{specialOn ? `Until ${fmtDate(p.special.ends)}` : 'Hidden from your site'}</span>
          </div>
          <EdTag ed={ed}>Change deal</EdTag>
        </div>
      )}

      <header className="hdr">
        <div className="w">
          <div className={`brand ${ed ? 'ed' : ''} ${flagged('name') ? 'flag' : ''}`} {...edAttrs('brand')}>
            {p.brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.brand.logoUrl} alt={name} />
            ) : (
              <>
                <span className="gl"><I.Leaf /></span>
                <span className="nm">
                  {p.brand.name}
                  {p.brand.tagline && <small>{p.brand.tagline}</small>}
                </span>
              </>
            )}
            <EdTag ed={ed}>Logo &amp; name</EdTag>
          </div>
          <nav className="nav">
            <a href="#services">Services</a>
            {p.prices.length > 0 && <a href="#prices">Prices</a>}
            {jobs.length > 0 && <a href="#work">Recent work</a>}
            <a href="#area">Service area</a>
            <a href="#request">Request service</a>
          </nav>
          <CallBtn p={p} ed={ed} flag={flagged('phone')} />
        </div>
      </header>

      <section className="hero">
        <div className="w">
          <div>
            <T ed={ed} k="copy.kicker" v={c.kicker} max={50} className="kick" />
            <h1>
              <T ed={ed} k="copy.headlineA" v={c.headlineA} max={40} ph="Headline" />
              <em>
                <T ed={ed} k="copy.headlineB" v={c.headlineB} max={30} />
              </em>
            </h1>
            <T ed={ed} k="copy.intro" v={c.intro} as="p" max={260} className="lede" multi />
            <div className="ctas">
              <CallBtn p={p} ed={ed} flag={flagged('phone')} big />
              <a className="ghostbtn" href="#request">Request service</a>
            </div>
            <p className={`today ${line.open ? 'open' : ''}`}><I.Clock />{line.text}</p>
          </div>
          <div className="dial" aria-hidden>
            <Dial city={p.city} brand={p.brand} />
          </div>
        </div>
      </section>

      {trust.length > 0 && (
        <div className="trust">
          <div className="w">
            {trust.map((t, i) => <span key={i}>{t}</span>)}
          </div>
        </div>
      )}
      {mode !== 'live' && (flagged('licence') || flagged('emergency')) && (
        <div className="trust confirmrow">
          <div className="w">
            {flagged('licence') && <span className="flag">Licensed &amp; insured? <FlagTag p={p} mode={mode} k="licence">Confirm</FlagTag></span>}
            {flagged('emergency') && <span className="flag">24/7 emergency service? <FlagTag p={p} mode={mode} k="emergency">Confirm</FlagTag></span>}
          </div>
        </div>
      )}

      <section className="sec" id="services">
        <div className="w">
          <div className="sh">
            <T ed={ed} k="copy.servicesTitle" v={c.servicesTitle} as="h2" max={30} />
            <T ed={ed} k="copy.servicesIntro" v={c.servicesIntro} as="p" max={140} multi />
          </div>
          <div className={`svcs ${flagged('services') ? 'flagwrap' : ''}`}>
            {p.services.map((s) => (
              <div className="svc" key={s.id}>
                {ed && <button type="button" className="more" data-panel="service" data-id={s.id}>Photo or remove</button>}
                {s.photoUrl ? (
                  <div className="ph">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.photoUrl} alt="" loading="lazy" />
                  </div>
                ) : (
                  <div className="ic"><I.ServiceGlyph icon={s.icon} /></div>
                )}
                <T ed={ed} k={`services.${s.id}.name`} v={s.name} as="h3" max={LIMITS.serviceName} ph="Service name" />
                <T ed={ed} k={`services.${s.id}.blurb`} v={s.blurb} as="p" max={LIMITS.serviceBlurb} ph="A line about it" multi />
              </div>
            ))}
            {ed && (
              <button type="button" className="svc add" data-panel="service" data-id="new">
                + Add work you do
              </button>
            )}
          </div>
          {flagged('services') && <p className="flagnote"><FlagTag p={p} mode={mode} k="services" /> {p.confirm.services?.detail}</p>}
        </div>
      </section>

      {(p.prices.length > 0 || ed) && (
        <section className="sec tight" id="prices">
          <div className="w">
            <div className={`prices ${ed ? 'ed' : ''}`} {...edAttrs('prices')}>
              <div>
                <h2>Straight prices</h2>
                <p>{p.prices.length ? 'No surprises before we start. We’ll quote anything else up front.' : 'Optional. Add your diagnostic fee or service call price so customers know what to expect.'}</p>
              </div>
              <ul>
                {p.prices.map((x) => (
                  <li key={x.id}>
                    <span>
                      {x.label}
                      {x.note && <small>{x.note}</small>}
                    </span>
                    <b>{formatPrice(x)}</b>
                  </li>
                ))}
              </ul>
              <EdTag ed={ed}>Change prices</EdTag>
            </div>
          </div>
        </section>
      )}

      {(jobs.length > 0 || ed) && (
        <section className="sec" id="work" style={{ background: 'var(--white)' }}>
          <div className="w">
            <div className="sh">
              <h2>Recent work</h2>
              <p>{ed && !jobs.length ? 'Optional. This section only shows on your website once you add a photo.' : 'Real jobs, photographed by our crew.'}</p>
            </div>
            <div className="jobs">
              {jobs.map((j) => (
                <figure className="job" key={j.id} {...edAttrs('photos', j.id)}>
                  <div className={`ph ${j.beforeUrl ? 'ba' : ''}`}>
                    {j.beforeUrl && (
                      <span className="half">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={j.beforeUrl} alt={`Before: ${j.caption}`} loading="lazy" />
                        <i>Before</i>
                      </span>
                    )}
                    <span className="half">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={j.photoUrl} alt={j.caption} loading="lazy" />
                      {j.beforeUrl && <i>After</i>}
                    </span>
                  </div>
                  <figcaption>
                    {j.caption}
                    <small>{[j.town, fmtDate(j.date)].filter(Boolean).join(' · ')}</small>
                  </figcaption>
                  {ed && (
                    <button type="button" className="share" data-share={`job:${j.id}`}>
                      <I.Share />
                      Share
                    </button>
                  )}
                </figure>
              ))}
              {ed && (
                <button type="button" className="job add" data-panel="photos" data-id="new">
                  <I.Camera />
                  Add a photo of a job
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="sec" id="area" style={jobs.length || ed ? undefined : { background: 'var(--white)' }}>
        <div className="w">
          <div className="area">
            <div>
              <div className="sh" style={{ marginBottom: 18 }}>
                <T ed={ed} k="copy.areaTitle" v={c.areaTitle} as="h2" max={30} />
              </div>
              <p className="areaintro">
                <T ed={ed} k="copy.areaIntro" v={c.areaIntro} max={140} multi />
                <FlagTag p={p} mode={mode} k="towns">Check towns</FlagTag>
              </p>
            </div>
            <div className={`towns ${ed ? 'ed' : ''} ${flagged('towns') ? 'flag' : ''}`} {...edAttrs('areas')}>
              {towns.map((t) => (
                <span key={t} className={`town ${t === p.city ? 'hq' : ''}`}>
                  <I.Pin />
                  {t}
                </span>
              ))}
              {postal.length > 0 && (
                <span className="town postal">
                  <I.Map />
                  Postal areas {postal.join(', ')}
                </span>
              )}
              <EdTag ed={ed}>Change towns</EdTag>
              <p className="notsure">Not on the list? Call. We may still be able to help.</p>
            </div>
          </div>
        </div>
      </section>

      {showReviews && (
        <section className="sec" style={{ background: 'var(--white)' }}>
          <div className="w">
            <div className="sh">
              <h2>Reviews</h2>
              {reviews?.rating ? (
                <p className="rating">
                  <b>{reviews.rating.toFixed(1)}</b>
                  <Stars n={reviews.rating} />
                  <span>{reviews.count} reviews on Google</span>
                </p>
              ) : (
                <p>{ed ? 'Your Google reviews show here once your Google listing is connected.' : ''}</p>
              )}
            </div>
            {reviews && reviews.reviews.length > 0 ? (
              <div className="revs">
                {reviews.reviews.slice(0, 3).map((r, i) => (
                  <blockquote className="rev" key={i}>
                    <Stars n={r.rating} />
                    <p>{r.text.length > 320 ? r.text.slice(0, 317).trimEnd() + '…' : r.text}</p>
                    <footer>
                      {r.authorUrl ? <a href={r.authorUrl} target="_blank" rel="noopener nofollow">{r.author}</a> : r.author}
                      <small>{r.when} · Google</small>
                    </footer>
                  </blockquote>
                ))}
              </div>
            ) : (
              <div className={`revs ${ed ? 'ed' : ''}`} {...edAttrs('reviews')}>
                {[0, 1, 2].map((i) => (
                  <div className="rev ghost" key={i}>
                    <div className="ln" />
                    <div className="ln" style={{ width: '86%' }} />
                    <div className="ln" style={{ width: '62%' }} />
                  </div>
                ))}
                <EdTag ed={ed}>Reviews</EdTag>
              </div>
            )}
            <div className="revlinks">
              {reviews?.mapsUrl && <a className="ghostbtn" href={reviews.mapsUrl} target="_blank" rel="noopener">Read all reviews on Google</a>}
              {reviewLink && !ed && <a className="ghostbtn" href={reviewLink} target="_blank" rel="noopener">Leave us a review</a>}
              {ed && (
                <button type="button" className="ghostbtn" data-panel="reviews">
                  Text a customer your review link
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {p.province === 'BC' && hasHeatPump && (
        <section style={{ paddingBlock: 'clamp(40px,6cqw,80px)' }}>
          <div className="w">
            <div className="rebate">
              <div>
                <h3>Thinking about a heat pump?</h3>
                <p>Rebates change often. Check what’s available right now on the Province of BC’s CleanBC Better Homes site, then call us to plan it.</p>
              </div>
              <a href="https://betterhomesbc.ca/find-rebates/" target="_blank" rel="noopener">See current rebates →</a>
            </div>
          </div>
        </section>
      )}

      <section className="sec" id="request" style={{ background: 'var(--white)' }}>
        <div className="w">
          <div className="req">
            <div className="contact">
              <div className="sh" style={{ marginBottom: 6 }}>
                <T ed={ed} k="copy.requestTitle" v={c.requestTitle} as="h2" max={30} />
              </div>
              <T ed={ed} k="copy.requestIntro" v={c.requestIntro} as="p" max={160} multi />
              <div>
                <CallBtn p={p} ed={ed} flag={flagged('phone')} />
              </div>
              <div className={`card ${ed ? 'ed' : ''} ${flagged('hours') ? 'flag' : ''}`} {...edAttrs('hours')}>
                <h3>
                  Hours <FlagTag p={p} mode={mode} k="hours" />
                </h3>
                <div className="hrs">
                  {DAYS.map((d) => {
                    const h = p.hours[d];
                    return (
                      <div className={`r ${d === dayOf(today) ? 'today' : ''}`} key={d}>
                        <span>{FULL[d]}</span>
                        <span>{h ? `${fmtHour(h[0])} – ${fmtHour(h[1])}` : <span className="c">Closed</span>}</span>
                      </div>
                    );
                  })}
                </div>
                {upcomingOverrides(p, now).map((o) => (
                  <div className="hol" key={o.id}>
                    <b>{fmtRange(o.from, o.to)}:</b> {o.closed ? 'Closed' : `${fmtHour(o.open ?? 9)}–${fmtHour(o.close ?? 17)}`}
                    {o.label ? ` · ${o.label}` : ''}. Regular hours after.
                  </div>
                ))}
                <EdTag ed={ed}>Hours &amp; days off</EdTag>
              </div>
            </div>
            <LeadForm businessId={businessId} towns={p.towns.filter((t) => !isPostalArea(t))} shopName={p.brand.name} disabled={mode !== 'live'} />
          </div>
        </div>
      </section>

      <footer className="ft">
        <div className="w">
          <div className="big">{name}</div>
          <div className="cols">
            {p.phone && (
              <div>
                <b>Call</b>
                {p.phone}
              </div>
            )}
            {p.email && (
              <div>
                <b>Email</b>
                {p.email}
              </div>
            )}
            <div>
              <b>Based in</b>
              {p.city}, {p.province}
            </div>
            <div>
              <b>Today</b>
              {line.text}
            </div>
          </div>
          <div className="disc">
            {mode === 'preview'
              ? `Private preview made by Bluerig from ${p.brand.name}’s public website. Not their official site, and not on the internet. Items marked “Check this” need the owner’s OK.`
              : <>Website by <a href="https://bluerig.ca">Bluerig</a></>}
          </div>
        </div>
      </footer>
      <div className="stickycall">
        <CallBtn p={p} ed={ed} flag={flagged('phone')} />
      </div>
    </div>
  );
}

type EdProps = { ed: boolean };

function edAttrsFor(ed: boolean, panel: string, extra?: string) {
  return ed ? { 'data-panel': panel, ...(extra ? { 'data-id': extra } : {}), role: 'button', tabIndex: 0 } : {};
}

function EdTag({ ed, children }: EdProps & { children: ReactNode }) {
  return ed ? <span className="edt">{children}</span> : null;
}

function FlagTag({ p, mode, k, children = 'Check this' }: { p: BusinessProfile; mode: SiteMode; k: ConfirmKey; children?: ReactNode }) {
  return mode !== 'live' && p.confirm[k] ? <span className="ftag" title={p.confirm[k]?.detail}>{children}</span> : null;
}

/** Inline-editable text. Module-level so React never remounts it mid-typing. */
function T({ ed, k, v, as: Tag = 'span', max, ph, className, multi }: EdProps & { k: string; v: string; as?: 'span' | 'p' | 'h2' | 'h3'; max: number; ph?: string; className?: string; multi?: boolean }) {
  return ed ? (
    <Tag className={className} data-k={k} data-max={max} data-ph={ph ?? ''} data-single={multi ? undefined : '1'} contentEditable="plaintext-only" suppressContentEditableWarning spellCheck={false}>
      {v}
    </Tag>
  ) : (
    <Tag className={className}>{v}</Tag>
  );
}

function CallBtn({ p, ed, flag, big }: EdProps & { p: BusinessProfile; flag: boolean; big?: boolean }) {
  const style = big ? { padding: '15px 20px', fontSize: 18 } : undefined;
  const inner = (
    <>
      <I.Phone />
      <span>
        <small>Call now</small>
        <span>{p.phone || 'Add your number'}</span>
      </span>
      <b className="cl">Call</b>
    </>
  );
  if (ed)
    return (
      <button type="button" className={`callbtn ed ${flag ? 'flag' : ''}`} {...edAttrsFor(true, 'phone')} style={style}>
        {inner}
        <EdTag ed>Change number</EdTag>
      </button>
    );
  if (!p.phone) return null;
  return (
    <a className={`callbtn ${flag ? 'flag' : ''}`} href={telHref(p.phone)} style={style}>
      {inner}
    </a>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span className="stars" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <I.Star key={i} style={{ opacity: i <= Math.round(n) ? 1 : 0.22 }} />
      ))}
    </span>
  );
}

/** Thermostat dial in the shop's colours. Decorative. */
function Dial({ city, brand }: { city: string; brand: { primary: string; accent: string; ink: string } }) {
  const ticks = [];
  for (let i = 0; i <= 40; i++) {
    const a = ((-220 + i * 6.5) * Math.PI) / 180;
    const r1 = i % 5 ? 176 : 168;
    const r2 = 186;
    ticks.push(
      <line
        key={i}
        x1={(200 + r1 * Math.cos(a)).toFixed(1)}
        y1={(200 + r1 * Math.sin(a)).toFixed(1)}
        x2={(200 + r2 * Math.cos(a)).toFixed(1)}
        y2={(200 + r2 * Math.sin(a)).toFixed(1)}
        stroke={i > 26 ? brand.accent : i < 12 ? '#7FB2DE' : mix(brand.primary, '#FFFFFF', 0.45)}
        strokeWidth={i % 5 ? 2 : 3.5}
        strokeLinecap="round"
      />,
    );
  }
  const nx = 200 + 120 * Math.cos((-55 * Math.PI) / 180);
  const ny = 200 + 120 * Math.sin((-55 * Math.PI) / 180);
  return (
    <svg viewBox="0 0 400 400">
      <circle cx="200" cy="200" r="198" fill={brand.ink} />
      {ticks}
      <circle cx="200" cy="200" r="150" fill="#F4F7F4" />
      <circle cx="200" cy="200" r="150" fill="none" stroke={mix(brand.primary, '#FFFFFF', 0.7)} strokeWidth="2" />
      <path d={`M200 200 L${nx.toFixed(1)} ${ny.toFixed(1)}`} stroke={brand.accent} strokeWidth="7" strokeLinecap="round" />
      <circle cx="200" cy="200" r="13" fill={brand.ink} />
      <text x="200" y="262" textAnchor="middle" fontWeight="850" fontSize="74" fill={brand.ink} style={{ fontStretch: '75%' }}>21°</text>
      <text x="200" y="292" textAnchor="middle" fontWeight="700" fontSize="13" letterSpacing="3" fill={brand.primary}>
        {city.toUpperCase().slice(0, 22)}
      </text>
    </svg>
  );
}
