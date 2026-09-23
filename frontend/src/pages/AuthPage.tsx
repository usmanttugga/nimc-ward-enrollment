import { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import Logo from '../components/Logo';
import { loadGeoData, State } from '../geoData';
import { formatAggregatorId, findNextAvailableSequence } from '../aggregatorUtils';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [signUpRole, setSignUpRole] = useState<'' | 'agent' | 'aggregator'>('');

  const [geoData, setGeoData] = useState<State[]>([]);

  // Agent fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [deviceDroidNumber, setDeviceDroidNumber] = useState('DROID-S120-');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Agent geo
  const [agentStateId, setAgentStateId] = useState('');
  const [agentStateName, setAgentStateName] = useState('');
  const [agentLgaId, setAgentLgaId] = useState('');
  const [agentLgaName, setAgentLgaName] = useState('');

  // Aggregator fields
  const [aggName, setAggName] = useState('');
  const [aggEmail, setAggEmail] = useState('');
  const [aggPassword, setAggPassword] = useState('');
  const [aggConfirmPassword, setAggConfirmPassword] = useState('');
  const [aggPhone, setAggPhone] = useState('');
  const [aggStateId, setAggStateId] = useState('');
  const [aggStateName, setAggStateName] = useState('');
  const [aggLgaId, setAggLgaId] = useState('');
  const [aggLgaName, setAggLgaName] = useState('');
  const [aggOfficeAddress, setAggOfficeAddress] = useState('');
  const [aggInviteCode, setAggInviteCode] = useState('');
  const [aggShowPassword, setAggShowPassword] = useState(false);
  const [aggShowConfirm, setAggShowConfirm] = useState(false);
  const [aggError, setAggError] = useState('');
  const [aggLoading, setAggLoading] = useState(false);

  useEffect(() => { loadGeoData().then(setGeoData); }, []);

  const agentLgas = geoData.find(s => s.id === agentStateId)?.lgas ?? [];
  const aggLgas = geoData.find(s => s.id === aggStateId)?.lgas ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (mode === 'register') {
      if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
      if (!agentStateId || !agentLgaId) { setError('State and LGA are required.'); return; }
    }
    setLoading(true);
    try {
      if (mode === 'register') {
        const inputDigits = deviceId.trim().replace(/\D/g, '');
        const withPrefix = `HENA-${inputDigits}`;
        const withoutPrefix = inputDigits;
        const exactInput = deviceId.trim();
        const variants = [...new Set([exactInput, withoutPrefix, withPrefix])].filter(v => v.length > 0);
        const snapshots = await Promise.all(variants.map(v => getDocs(query(collection(db, 'users'), where('deviceId', '==', v)))));
        if (snapshots.some(s => !s.empty)) {
          setError('This Device ID is already registered to another account.');
          setLoading(false);
          return;
        }
        // Check Device DROID Number uniqueness (skip if only the prefix was entered)
        const droidValue = deviceDroidNumber.trim();
        if (droidValue && droidValue !== 'DROID-S120-') {
          const droidSnap = await getDocs(query(collection(db, 'users'), where('deviceDroidNumber', '==', droidValue)));
          if (!droidSnap.empty) {
            setError('This Device DROID Number is already registered to another account.');
            setLoading(false);
            return;
          }
        }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name });
        await setDoc(doc(db, 'users', cred.user.uid), {
          name, email, role: 'AGENT', deviceId, deviceDroidNumber, phone,
          profileStateId: agentStateId, profileStateName: agentStateName,
          profileLgaId: agentLgaId, profileLgaName: agentLgaName,
          createdAt: new Date().toISOString(),
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      const msg: Record<string, string> = {
        'auth/email-already-in-use': 'Email already registered.',
        'auth/invalid-credential': 'Invalid email or password.',
        'auth/weak-password': 'Password must be at least 6 characters.',
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password.',
      };
      setError(msg[err.code] || err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAggregatorSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAggError('');
    if (!aggName.trim() || !aggEmail.trim() || !aggPassword.trim() || !aggConfirmPassword.trim() || !aggPhone.trim() || !aggOfficeAddress.trim()) {
      setAggError('All fields are required.'); return;
    }
    if (!aggInviteCode.trim()) { setAggError('Invite code is required.'); return; }
    if (aggPassword !== aggConfirmPassword) { setAggError('Passwords do not match.'); return; }
    if (!aggStateId || !aggLgaId) { setAggError('State and LGA are required.'); return; }
    setAggLoading(true);
    try {
      const settingsSnap = await getDoc(doc(db, 'settings', 'aggregatorInviteCode'));
      const storedCode: string = settingsSnap.exists() ? (settingsSnap.data().code ?? '') : '';
      if (!storedCode) { setAggError('Aggregator registration is not available at this time.'); setAggLoading(false); return; }
      if (aggInviteCode.trim() !== storedCode.trim()) { setAggError('Invalid invite code.'); setAggLoading(false); return; }
      const existingSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'AGGREGATOR')));
      const existingIds = existingSnap.docs.map(d => d.data().aggregatorId as string).filter(Boolean);
      const aggId = formatAggregatorId(findNextAvailableSequence(existingIds));
      const cred = await createUserWithEmailAndPassword(auth, aggEmail, aggPassword);
      await updateProfile(cred.user, { displayName: aggName });
      await setDoc(doc(db, 'users', cred.user.uid), {
        name: aggName, email: aggEmail, role: 'AGGREGATOR', aggregatorId: aggId,
        phone: aggPhone, officeAddress: aggOfficeAddress,
        profileStateId: aggStateId, profileStateName: aggStateName,
        profileLgaId: aggLgaId, profileLgaName: aggLgaName,
        createdAt: new Date().toISOString(),
      });
    } catch (err: any) {
      const msg: Record<string, string> = {
        'auth/email-already-in-use': 'Email already registered.',
        'auth/weak-password': 'Password must be at least 6 characters.',
      };
      setAggError(msg[err.code] || err.message);
    } finally {
      setAggLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err: any) {
      const msg: Record<string, string> = {
        'auth/user-not-found': 'No account found with this email.',
        'auth/invalid-email': 'Invalid email address.',
      };
      setError(msg[err.code] || err.message);
    } finally {
      setLoading(false);
    }
  }

  const eyeIcon = (show: boolean) => show
    ? <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
    : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>;

  const inputClass = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all';

  return (
    <div className="min-h-screen flex">
      {/* ── LEFT PANEL — Brand / Hero ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-teal-800 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-teal-700/50" />
          <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-teal-900/60" />
          <div className="absolute top-1/2 -right-16 w-64 h-64 rounded-full bg-pink-600/20" />
        </div>

        {/* Logo + Brand */}
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-10">
            <Logo size={52} />
            <div>
              <div className="font-black text-lg leading-tight tracking-tight">
                <span className="text-pink-300">2 PLUS </span>
                <span className="text-white">TECHNOLOGIES</span>
              </div>
              <div className="text-teal-300 text-xs tracking-widest uppercase mt-0.5">Innovative Minds</div>
            </div>
          </div>

          <h1 className="text-4xl font-extrabold text-white leading-tight mb-4">
            Enrollment<br />
            <span className="text-pink-300">Portal</span>
          </h1>
          <p className="text-teal-200 text-base leading-relaxed max-w-sm">
            Your central hub for managing field enrollments, tracking agent performance, and streamlining data collection — all in one place.
          </p>
        </div>

        {/* Feature highlights */}
        <div className="relative z-10 space-y-4">
          {[
            { icon: '📋', label: 'Submit daily enrollment records', desc: 'Agents log field data directly from any device' },
            { icon: '📊', label: 'Track enrollment logs', desc: 'Monthly performance records per agent' },
            { icon: '🎯', label: 'Personalization tracking', desc: 'Record and monitor personalization figures' },
            { icon: '👥', label: 'Aggregator management', desc: 'Manage teams and monitor field networks' },
          ].map(f => (
            <div key={f.label} className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 text-lg">{f.icon}</div>
              <div>
                <div className="text-white text-sm font-semibold leading-tight">{f.label}</div>
                <div className="text-teal-300 text-xs mt-0.5">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="relative z-10 text-teal-400 text-xs">
          © {new Date().getFullYear()} 2 Plus Technologies. All rights reserved.
        </div>
      </div>

      {/* ── RIGHT PANEL — Auth Forms ── */}
      <div className="w-full lg:w-1/2 flex flex-col bg-white">
        {/* Mobile header (shown only on small screens) */}
        <div className="lg:hidden bg-teal-800 px-6 py-5 flex items-center gap-3">
          <Logo size={36} />
          <div>
            <div className="font-black text-sm leading-tight">
              <span className="text-pink-300">2 PLUS </span>
              <span className="text-white">TECHNOLOGIES</span>
            </div>
            <div className="text-teal-300 text-xs">Enrollment Portal</div>
          </div>
        </div>

        {/* Scrollable form area */}
        <div className="flex-1 overflow-y-auto flex items-start lg:items-center justify-center px-6 py-10">
          <div className="w-full max-w-md">

            {/* ── FORGOT PASSWORD ── */}
            {mode === 'forgot' && (
              <div>
                {resetSent ? (
                  <div className="text-center space-y-5">
                    <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-gray-800">Check your inbox</p>
                      <p className="text-sm text-gray-500 mt-2">We sent a reset link to <span className="font-semibold text-gray-700">{email}</span>. Follow the link to set a new password.</p>
                    </div>
                    <button onClick={() => { setMode('login'); setResetSent(false); setEmail(''); }}
                      className="w-full bg-teal-700 hover:bg-teal-800 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
                      Back to Login
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-5">
                    <div>
                      <button type="button" onClick={() => { setMode('login'); setError(''); }}
                        className="flex items-center gap-1.5 text-teal-600 hover:text-teal-800 text-sm font-medium mb-6 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        Back to Login
                      </button>
                      <h2 className="text-2xl font-extrabold text-gray-900">Forgot password?</h2>
                      <p className="text-gray-500 text-sm mt-1">No worries — we'll send you a reset link.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                      <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="agent@example.com" className={inputClass} />
                    </div>
                    {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-2.5">{error}</div>}
                    <button type="submit" disabled={loading}
                      className="w-full bg-teal-700 hover:bg-teal-800 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 text-sm">
                      {loading ? 'Sending…' : 'Send Reset Link'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* ── LOGIN / REGISTER ── */}
            {mode !== 'forgot' && (
              <>
                {/* Heading */}
                <div className="mb-7">
                  <h2 className="text-2xl font-extrabold text-gray-900">
                    {mode === 'login' ? 'Welcome back' : 'Create an account'}
                  </h2>
                  <p className="text-gray-500 text-sm mt-1">
                    {mode === 'login'
                      ? 'Sign in to access your enrollment portal.'
                      : 'Join the 2 Plus Technologies enrollment network.'}
                  </p>
                </div>

                {/* Tab switcher */}
                <div className="flex bg-gray-100 rounded-xl p-1 mb-7 gap-1">
                  {(['login', 'register'] as const).map(m => (
                    <button key={m} type="button"
                      onClick={() => { setMode(m); setError(''); setAggError(''); if (m === 'login') setSignUpRole(''); }}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === m ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                      {m === 'login' ? '🔑 Login' : '✍️ Sign Up'}
                    </button>
                  ))}
                </div>

                {/* ── LOGIN FORM ── */}
                {mode === 'login' && (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                      <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="agent@example.com" className={inputClass} />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-sm font-medium text-gray-700">Password</label>
                        <button type="button" onClick={() => { setMode('forgot'); setError(''); setResetSent(false); }}
                          className="text-xs text-teal-600 hover:text-teal-800 font-semibold transition-colors">
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <input type={showPassword ? 'text' : 'password'} required value={password}
                          onChange={e => setPassword(e.target.value)} placeholder="Enter your password"
                          className={`${inputClass} pr-11`} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                          {eyeIcon(showPassword)}
                        </button>
                      </div>
                    </div>
                    {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-2.5">{error}</div>}
                    <button type="submit" disabled={loading}
                      className="w-full bg-teal-700 hover:bg-teal-800 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 text-sm shadow-sm shadow-teal-200">
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                          </svg>
                          Signing in…
                        </span>
                      ) : 'Sign In'}
                    </button>

                    {/* Role info cards */}
                    <div className="pt-2">
                      <p className="text-xs text-gray-400 text-center mb-3">Accessible to all portal users</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { icon: '🧑‍💼', role: 'Agent', desc: 'Submit & track enrollments' },
                          { icon: '👥', role: 'Aggregator', desc: 'Manage your field team' },
                        ].map(r => (
                          <div key={r.role} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                            <div className="text-xl mb-1">{r.icon}</div>
                            <div className="text-xs font-semibold text-gray-700">{r.role}</div>
                            <div className="text-xs text-gray-400 leading-tight mt-0.5">{r.desc}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </form>
                )}

                {/* ── REGISTER FORM ── */}
                {mode === 'register' && (
                  <form onSubmit={signUpRole === 'aggregator' ? handleAggregatorSubmit : handleSubmit} className="space-y-4">
                    {/* Role selector */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">I am registering as <span className="text-red-500">*</span></label>
                      <div className="grid grid-cols-2 gap-3">
                        {(['agent', 'aggregator'] as const).map(r => (
                          <button key={r} type="button"
                            onClick={() => setSignUpRole(r)}
                            className={`flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${signUpRole === r ? 'border-teal-600 bg-teal-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}>
                            <span className="text-2xl">{r === 'agent' ? '🧑‍💼' : '👥'}</span>
                            <div>
                              <div className={`text-sm font-semibold ${signUpRole === r ? 'text-teal-700' : 'text-gray-700'}`}>
                                {r === 'agent' ? 'Agent' : 'Aggregator'}
                              </div>
                              <div className="text-xs text-gray-400">{r === 'agent' ? 'Field enrollment' : 'Team manager'}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Agent registration fields */}
                    {signUpRole === 'agent' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                          <input type="text" required value={name} onChange={e => setName(e.target.value)}
                            placeholder="Enter your full name" className={inputClass} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Device ID</label>
                          <input type="text" required value={deviceId} onChange={e => setDeviceId(e.target.value.slice(0, 20))}
                            placeholder="HENA-315835789326461" maxLength={20}
                            className={`${inputClass} font-mono`} />
                          <p className="text-xs text-gray-400 mt-1">{deviceId.length}/20 characters</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Device DROID Number</label>
                          <input
                            type="text"
                            value={deviceDroidNumber}
                            onChange={e => {
                              const val = e.target.value;
                              if (val.startsWith('DROID-S120-')) {
                                setDeviceDroidNumber(val);
                              } else {
                                setDeviceDroidNumber('DROID-S120-');
                              }
                            }}
                            placeholder="DROID-S120-"
                            className={`${inputClass} font-mono`}
                          />
                          <p className="text-xs text-gray-400 mt-1">Alphanumeric suffix after <span className="font-mono">DROID-S120-</span></p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                          <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                            placeholder="agent@example.com" className={inputClass} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                          <input type="tel" required value={phone}
                            onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                            placeholder="08012345678" className={inputClass} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">State</label>
                            <select required value={agentStateId}
                              onChange={e => { const sel = geoData.find(s => s.id === e.target.value); setAgentStateId(e.target.value); setAgentStateName(sel?.name ?? ''); setAgentLgaId(''); setAgentLgaName(''); }}
                              className={inputClass}>
                              <option value="">Select…</option>
                              {geoData.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">LGA</label>
                            <select required disabled={!agentStateId} value={agentLgaId}
                              onChange={e => { const sel = agentLgas.find(l => l.id === e.target.value); setAgentLgaId(e.target.value); setAgentLgaName(sel?.name ?? ''); }}
                              className={`${inputClass} disabled:opacity-60`}>
                              <option value="">Select…</option>
                              {agentLgas.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                            <div className="relative">
                              <input type={showPassword ? 'text' : 'password'} required value={password}
                                onChange={e => setPassword(e.target.value)} placeholder="Min. 6 chars"
                                className={`${inputClass} pr-10`} />
                              <button type="button" onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                {eyeIcon(showPassword)}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm</label>
                            <div className="relative">
                              <input type={showConfirm ? 'text' : 'password'} required value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter"
                                className={`${inputClass} pr-10`} />
                              <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                {eyeIcon(showConfirm)}
                              </button>
                            </div>
                          </div>
                        </div>
                        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-2.5">{error}</div>}
                        <button type="submit" disabled={loading}
                          className="w-full bg-teal-700 hover:bg-teal-800 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 text-sm shadow-sm shadow-teal-200">
                          {loading ? 'Creating account…' : 'Create Agent Account'}
                        </button>
                      </>
                    )}

                    {/* Aggregator registration fields */}
                    {signUpRole === 'aggregator' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                          <input type="text" required value={aggName} onChange={e => setAggName(e.target.value)}
                            placeholder="Enter your full name" className={inputClass} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                          <input type="email" required value={aggEmail} onChange={e => setAggEmail(e.target.value)}
                            placeholder="aggregator@example.com" className={inputClass} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                          <input type="tel" required value={aggPhone}
                            onChange={e => setAggPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                            placeholder="08012345678" className={inputClass} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">State</label>
                            <select required value={aggStateId}
                              onChange={e => { const sel = geoData.find(s => s.id === e.target.value); setAggStateId(e.target.value); setAggStateName(sel?.name ?? ''); setAggLgaId(''); setAggLgaName(''); }}
                              className={inputClass}>
                              <option value="">Select…</option>
                              {geoData.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">LGA</label>
                            <select required disabled={!aggStateId} value={aggLgaId}
                              onChange={e => { const sel = aggLgas.find(l => l.id === e.target.value); setAggLgaId(e.target.value); setAggLgaName(sel?.name ?? ''); }}
                              className={`${inputClass} disabled:opacity-60`}>
                              <option value="">Select…</option>
                              {aggLgas.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Office Address</label>
                          <textarea required value={aggOfficeAddress} onChange={e => setAggOfficeAddress(e.target.value)}
                            placeholder="Enter your office address" rows={2}
                            className={`${inputClass} resize-none`} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                            <div className="relative">
                              <input type={aggShowPassword ? 'text' : 'password'} required value={aggPassword}
                                onChange={e => setAggPassword(e.target.value)} placeholder="Min. 6 chars"
                                className={`${inputClass} pr-10`} />
                              <button type="button" onClick={() => setAggShowPassword(!aggShowPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                {eyeIcon(aggShowPassword)}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm</label>
                            <div className="relative">
                              <input type={aggShowConfirm ? 'text' : 'password'} required value={aggConfirmPassword}
                                onChange={e => setAggConfirmPassword(e.target.value)} placeholder="Re-enter"
                                className={`${inputClass} pr-10`} />
                              <button type="button" onClick={() => setAggShowConfirm(!aggShowConfirm)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                {eyeIcon(aggShowConfirm)}
                              </button>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Invite Code</label>
                          <input type="text" required value={aggInviteCode} onChange={e => setAggInviteCode(e.target.value)}
                            placeholder="Contact admin for your code" className={inputClass} />
                          <p className="text-xs text-gray-400 mt-1">Required for aggregator registration.</p>
                        </div>
                        {aggError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-2.5">{aggError}</div>}
                        <button type="submit" disabled={aggLoading}
                          className="w-full bg-teal-700 hover:bg-teal-800 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 text-sm shadow-sm shadow-teal-200">
                          {aggLoading ? 'Creating account…' : 'Create Aggregator Account'}
                        </button>
                      </>
                    )}

                    {/* Show CTA only if no role selected */}
                    {signUpRole === '' && (
                      <div className="bg-teal-50 border border-teal-100 rounded-xl px-4 py-4 text-center text-sm text-teal-700">
                        Select your role above to get started with registration.
                      </div>
                    )}
                  </form>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right panel footer */}
        <div className="px-6 py-4 border-t border-gray-100 text-center text-xs text-gray-400 lg:hidden">
          © {new Date().getFullYear()} 2 Plus Technologies
        </div>
      </div>
    </div>
  );
}
