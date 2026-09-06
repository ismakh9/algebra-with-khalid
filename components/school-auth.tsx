'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, GraduationCap, LayoutDashboard, LogOut, Mail, ShieldCheck } from 'lucide-react';
import { getBackend } from '@/lib/backend';
import { pageUrl, schoolEmail, type Account } from '@/lib/school';
import { DocumentLink } from './document-link';

type AuthState = { account: Account | null; loading: boolean; error: string; configured: boolean; refresh: () => Promise<void>; signOut: () => Promise<void> };
const AuthContext = createContext<AuthState | null>(null);
export function useSchoolAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('School authentication provider missing.');
  return value;
}

export function SchoolAuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const turn = ++sequence.current;
    const backend = getBackend();
    setConfigured(!!backend);
    if (!backend) { setLoading(false); return; }
    try {
      const { data: { session }, error: sessionError } = await backend.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) { if (turn === sequence.current) { setAccount(null); setError(''); } return; }
      const { data, error: accountError } = await backend.rpc('get_school_account');
      if (accountError) throw accountError;
      if (!data || !schoolEmail(data.email)) throw new Error('A verified school account is required.');
      if (turn === sequence.current) { setAccount(data as Account); setError(''); }
    } catch {
      if (turn === sequence.current) { setAccount(null); setError('Could not verify your account. Check your connection and try again.'); }
    } finally { if (turn === sequence.current) setLoading(false); }
  }, []);
  useEffect(() => {
    // oxlint-disable-next-line react/react-compiler -- Synchronize the external Auth session after hydration.
    void refresh();
    const backend = getBackend();
    // Avoid calling another Auth method inside the SDK's synchronous callback.
    const listener = backend?.auth.onAuthStateChange(() => { queueMicrotask(() => { void refresh(); }); });
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- Sequence is a request generation counter, not a DOM ref.
    return () => { ++sequence.current; listener?.data.subscription.unsubscribe(); };
  }, [refresh]);
  const signOut = useCallback(async () => {
    const backend = getBackend();
    if (backend) {
      const { error: logoutError } = await backend.auth.signOut({ scope: 'local' });
      if (logoutError) { setError('Could not sign out. Please try again.'); return; }
    }
    ++sequence.current;
    setAccount(null);
    window.location.assign(pageUrl('/login', process.env.NEXT_PUBLIC_BASE_PATH ?? ''));
  }, []);
  return <AuthContext.Provider value={{ account, loading, error, configured, refresh, signOut }}>{children}</AuthContext.Provider>;
}

export function SchoolBrand() {
  return <DocumentLink className="brand" href="/" aria-label="Algebra with Khalid home">
    <span className="brand-mark" aria-hidden="true">x<span>·</span></span>
    <span className="brand-name">Algebra<span>with Khalid</span></span>
  </DocumentLink>;
}

export function AccountMenu() {
  const { account, signOut, error } = useSchoolAuth();
  if (!account) return null;
  return <div className="school-account-bar">
    <span className="school-account-email"><ShieldCheck size={15} />{account.email}</span>
    <span className="school-account-actions">
      {account.role === 'teacher' && <DocumentLink href="/dashboard"><LayoutDashboard size={15} />Teacher dashboard</DocumentLink>}
      <button onClick={() => { void signOut(); }}><LogOut size={14} />Sign out</button>
    </span>
    {error && <span role="alert">{error}</span>}
  </div>;
}

export function SchoolGate({ children, teacher = false }: { children: ReactNode; teacher?: boolean }) {
  const { account, loading } = useSchoolAuth();
  if (loading) return <output className="school-loading">Checking your school account…</output>;
  if (!account) return <SchoolLogin />;
  if (teacher && account.role !== 'teacher') return <div className="school-auth-shell"><SchoolBrand /><section className="school-card">
    <ShieldCheck className="school-icon" /><h1>Teacher access only.</h1>
    <p>Your student account is ready for the solver and challenges.</p><DocumentLink className="primary-button" href="/">Back to learning <ArrowRight size={17} /></DocumentLink>
    <button className="text-button" onClick={() => { void getBackend()?.auth.signOut({ scope: 'local' }); }}>Use a different account</button>
  </section></div>;
  return <>{children}</>;
}

export function SchoolLogin() {
  const { account, configured, loading, error: accountError, refresh, signOut } = useSchoolAuth();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((value) => Math.max(value - 1, 0)), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  // A confirmation email can be generated before a deployment has refreshed
  // its redirect settings. If Supabase sends that link back to /login.html,
  // the session is still valid; finish the same sign-in flow automatically.
  useEffect(() => {
    if (!account || typeof window === 'undefined') return;
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    const loginPath = pageUrl('/login', basePath);
    const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
    const normalizedLoginPath = loginPath.replace(/\/$/, '') || '/';
    if (currentPath === normalizedLoginPath || currentPath.endsWith('/login.html')) {
      window.location.replace(pageUrl('/', basePath));
    }
  }, [account]);
  async function sendCode() {
    const normalized = schoolEmail(email);
    if (!normalized) { setError('Please use an email ending in @abaarsoschool.org or @studentabaarso.org.'); return; }
    const backend = getBackend();
    if (!backend || busy || seconds) return;
    setError(''); setBusy(true);
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
      const { error: sendError } = await backend.auth.signInWithOtp({
        email: normalized,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}${pageUrl('/', basePath)}`,
        },
      });
      if (sendError) throw sendError;
      setSentTo(normalized); setCode(''); setSeconds(60);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message.toLowerCase() : '';
      if (detail.includes('security') || detail.includes('after') || detail.includes('rate limit') || detail.includes('too many')) {
        setError('Please wait 60 seconds before requesting another verification email.');
      } else if (detail.includes('not authorized')) {
        setError('Supabase is still using its limited email sender. Connect the Brevo SMTP settings, then try again.');
      } else if (detail.includes('smtp') || detail.includes('send email') || detail.includes('sending')) {
        setError('The email service is not ready yet. Check the Brevo SMTP settings in Supabase, then try again.');
      } else {
        setError('We couldn’t send the verification email. Check your school email and try again in a minute. If this continues, contact Khalid.');
      }
    } finally { setBusy(false); }
  }
  async function verifyCode() {
    if (!/^\d{6}$/.test(code)) { setError('Enter the six-digit number from your email.'); return; }
    const backend = getBackend();
    if (!backend || !sentTo || busy) return;
    setBusy(true); setError('');
    try {
      const { data, error: verifyError } = await backend.auth.verifyOtp({ email: sentTo, token: code, type: 'email' });
      if (verifyError || !data.session) throw verifyError ?? new Error('Verification failed');
      setCode('');
      await refresh();
      const { data: profile, error: profileError } = await backend.rpc('get_school_account');
      if (profileError || !profile) throw new Error('Account unavailable');
      // Verification always finishes at the learning landing page. Teachers
      // can open their dashboard from the account menu after signing in.
      window.location.assign(pageUrl('/', process.env.NEXT_PUBLIC_BASE_PATH ?? ''));
    } catch { setError('That code is invalid or has expired. Check the latest email or request another code.'); }
    finally { setBusy(false); }
  }
  return <div className="school-auth-shell">
    <header className="school-auth-header"><SchoolBrand /><span><GraduationCap size={18} />Abaarso School</span></header>
    <main className="school-auth-main">
      <section className="school-welcome"><span className="eyebrow">YOUR NEXT STEP STARTS HERE</span>
        <h1>A little practice.<br /><span>A lot of possibility.</span></h1>
        <p>Your school account keeps your learning together, one equation at a time.</p>
        <div className="school-equation-art" aria-hidden="true"><span>2x + 5 = 17</span><i>−5 <span>on both sides</span> −5</i><strong>2x = 12</strong><b>x = 6 <ShieldCheck size={23} /></b></div>
      </section>
      <section className="school-card" aria-labelledby="school-login-title">
        <span className="school-icon"><Mail size={24} /></span>
        <h2 id="school-login-title">{account ? 'You’re signed in.' : sentTo ? 'Check your school inbox.' : 'Welcome to your classroom.'}</h2>
        {account ? <><p>{account.email}</p><DocumentLink className="primary-button" href="/">Continue <ArrowRight size={17} /></DocumentLink><button className="text-button" onClick={() => { void signOut(); }}>Sign out</button></> : <>
        <p>{sentTo ? <>Enter the six-digit code sent to {sentTo}. If the email shows a “Confirm your email” link instead, click it once and this page will finish signing you in.</> : 'Sign in or create your account with your Abaarso school email. No password to remember.'}</p>
          {!loading && !configured && <output className="school-notice">School sign-in is being connected. Please check back shortly.</output>}
          <form onSubmit={(event) => { event.preventDefault(); void (sentTo ? verifyCode() : sendCode()); }}>
            {!sentTo ? <><label htmlFor="school-email">School email</label><input id="school-email" name="email" type="email" autoComplete="email" placeholder="your.name@studentabaarso.org" aria-describedby="school-email-domains" maxLength={254} required value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} disabled={busy} /><p id="school-email-domains" className="school-form-hint">Use your @abaarsoschool.org or @studentabaarso.org email.</p></> : <>
              <label htmlFor="school-code">Verification number</label><input id="school-code" className="school-code" name="one-time-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" required value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0,6)); setError(''); }} disabled={busy} />
              <p className="school-form-hint">Use the latest code. It expires in 10 minutes and works only once.</p>
            </>}
            {(error || accountError) && <p className="school-error" role="alert">{error || accountError}</p>}
            <button className="primary-button" type="submit" disabled={!configured || busy || loading}>{busy ? 'Please wait…' : sentTo ? 'Verify and sign in' : 'Send verification code'}<ArrowRight size={17} /></button>
          </form>
          {sentTo && <div className="school-resend"><button className="text-button" disabled={seconds > 0 || busy} onClick={() => { void sendCode(); }}>{seconds ? `Resend in ${seconds}s` : 'Resend code'}</button><button className="text-button" disabled={busy} onClick={() => { setSentTo(''); setCode(''); setError(''); }}>Change email</button></div>}
          {accountError && <button className="text-button" onClick={() => { void refresh(); }}>Try checking my account again</button>}
          <p className="school-privacy"><ShieldCheck size={17} /><span>Your teacher can see your sign-ins, submitted equations, and practice results to support your learning.</span></p>
        </>}
      </section>
    </main>
    <footer className="school-auth-footer">Algebra with Khalid · Made for Abaarso School</footer>
  </div>;
}
