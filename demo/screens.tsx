// Guided example only: the owner's claim steps, simulated so the flow can be
// clicked through with no backend.
import { useState } from 'react';

export function DemoClaim({ phone, onDone }: { phone: string; onDone: () => void }) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('owner@northline.example');
  const [code, setCode] = useState('');
  return (
    <div className="claim">
      <h2>Make it yours</h2>
      <p className="claim-sub">Two quick steps so we know it’s really Northline.</p>
      <ol className="claim-steps" aria-label="Steps">
        <li aria-current={step === 'email'}>Your email</li>
        <li aria-current={step === 'code'}>Code to your shop phone</li>
      </ol>
      {step === 'email' ? (
        <>
          <label className="field">
            Your email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="btn primary big" disabled={!email.includes('@')} onClick={() => setStep('code')}>Next</button>
          <p className="note">This emails you a sign-in link. No password. (In this example nothing is sent.)</p>
        </>
      ) : (
        <>
          <p>We texted a 6-digit code to the phone number on the website: <b>{phone}</b>.</p>
          <label className="field">
            6-digit code
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="123456" />
          </label>
          <button className="btn primary big" disabled={code.length !== 6} onClick={onDone}>Done: open my editor</button>
          <p className="note">In this example, type any 6 digits.</p>
        </>
      )}
    </div>
  );
}
