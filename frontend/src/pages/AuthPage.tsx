import { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import Logo from '../components/Logo';
import { loadGeoData, State } from '../geoData';
import { formatAggregatorId, findNextAvailableSequence } from '../aggregatorUtils';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  // Single sign-up role selector: '' = not selected, 'agent', 'aggregator'
  const [signUpRole, setSignUpRole] = useState<'' | 'agent' | 'aggregator'>('');

  // GeoData
  const [geoData, setGeoData] = useState<State[]>([]);

  // Agent Sign Up fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Agent Sign Up geo fields
  const [agentStateId, setAgentStateId] = useState('');
  const [agentStateName, setAgentStateName] = useState('');
  const [agentLgaId, setAgentLgaId] = useState('');
  const [agentLgaName, setAgentLgaName] = useState('');

  // Aggregator Sign Up fields
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

  // Load geo data once on mount
  useEffect(() => { loadGeoData().then(setGeoData); }, []);

  // Derived LGA lists
  const agentLgas = geoData.find(s => s.id === agentStateId)?.lgas ?? [];
  const aggLgas = geoData.find(s => s.id === aggStateId)?.lgas ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (mode === 'register') {
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (!agentStateId || !agentLgaId) {
        setError('State and LGA are required.');
        return;
      }
    }
    setLoading(true);
    try {
      if (mode === 'register') {
        // Check if Device ID is already registered before creating the Auth user.
        // Checks the exact input, the bare digits, and the HENA- prefixed form
        // so "HENA-34898799834659" and "34898799834659" are treated as the same device.
        const inputDigits = deviceId.trim().replace(/\D/g, '');
        const withPrefix = `HENA-${inputDigits}`;
        const withoutPrefix = inputDigits;
        const exactInput = deviceId.trim();

        // Build unique variants to check (avoid duplicate queries)
        const variants = [...new Set([exactInput, withoutPrefix, withPrefix])].filter(v => v.length > 0);

        const snapshots = await Promise.all(
          variants.map(v => getDocs(query(collection(db, 'users'), where('deviceId', '==', v))))
        );
        if (snapshots.some(s => !s.empty)) {
          setError('This Device ID is already registered to another account.');
          setLoading(false);
          return;
        }

        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name });
        await setDoc(doc(db, 'users', cred.user.uid), {
          name,
          email,
          role: 'AGENT',
          deviceId,
          phone,
          profileStateId: agentStateId,
          profileStateName: agentStateName,
          profileLgaId: agentLgaId,
          profileLgaName: agentLgaName,
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

    // Validate all fields
    if (!aggName.trim() || !aggEmail.trim() || !aggPassword.trim() || !aggConfirmPassword.trim() || !aggPhone.trim() || !aggOfficeAddress.trim()) {
      setAggError('All fields are required.');
      return;
    }
    if (!aggInviteCode.trim()) {
      setAggError('Invite code is required.');
      return;
    }
    if (aggPassword !== aggConfirmPassword) {
      setAggError('Passwords do not match.');
      return;
    }
    if (!aggStateId || !aggLgaId) {
      setAggError('State and LGA are required.');
      return;
    }

    setAggLoading(true);
    try {
      // Verify invite code against Firestore settings/aggregatorInviteCode
      const settingsSnap = await getDoc(doc(db, 'settings', 'aggregatorInviteCode'));
      const storedCode: string = settingsSnap.exists() ? (settingsSnap.data().code ?? '') : '';

      if (!storedCode) {
        setAggError('Aggregator registration is not available at this time. Please contact the administrator.');
        setAggLoading(false);
        return;
      }
      if (aggInviteCode.trim() !== storedCode.trim()) {
        setAggError('Invalid invite code. Please contact the administrator.');
        setAggLoading(false);
        return;
      }
      // Generate aggregator ID using gap-filling BEFORE creating the Auth user
      // to avoid any race conditions with onAuthStateChanged.
      // We fetch existing IDs, find the lowest gap, and assign it.
      // In the extremely unlikely event of a simultaneous registration collision,
      // the admin can manually reassign the duplicate via the Aggregators tab.
      const existingSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'AGGREGATOR')));
      const existingIds = existingSnap.docs.map(d => d.data().aggregatorId as string).filter(Boolean);
      const nextSeq = findNextAvailableSequence(existingIds);
      const aggId = formatAggregatorId(nextSeq);

      // Create Firebase Auth user (primary auth — user is registering themselves)
      const cred = await createUserWithEmailAndPassword(auth, aggEmail, aggPassword);
      await updateProfile(cred.user, { displayName: aggName });

      // Write Firestore user document
      await setDoc(doc(db, 'users', cred.user.uid), {
        name: aggName,
        email: aggEmail,
        role: 'AGGREGATOR',
        aggregatorId: aggId,
        phone: aggPhone,
        officeAddress: aggOfficeAddress,
        profileStateId: aggStateId,
        profileStateName: aggStateName,
        profileLgaId: aggLgaId,
        profileLgaName: aggLgaName,
        createdAt: new Date().toISOString(),
      });
      // Firebase Auth state change in App.tsx will route to AggregatorPage automatically
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

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';

  return (
    <div className="min-h-screen bg-teal-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3"><Logo size={80} /></div>
          <div className="text-xl font-black tracking-tight leading-tight">
            <span className="text-pink-600">2 PLUS </span>
            <span className="text-teal-600">TECHNOLOGIES</span>
          </div>
          <div className="text-xs text-gray-400 uppercase tracking-widest mt-0.5 mb-2">Innovative Minds</div>
          <p className="text-gray-500 text-sm">Enrollment Portal</p>
        </div>

        {/* Forgot Password View */}
        {mode === 'forgot' && (
          <div>
            {resetSent ? (
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center mx-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-gray-700 font-medium">Reset link sent!</p>
                <p className="text-sm text-gray-500">Check your inbox at <span className="font-medium text-gray-700">{email}</span> and follow the link to reset your password.</p>
                <button onClick={() => { setMode('login'); setResetSent(false); setEmail(''); }}
                  className="w-full bg-teal-700 hover:bg-teal-800 text-white font-medium py-2.5 rounded-lg transition-colors text-sm mt-2">
                  Back to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-800 mb-1">Reset your password</h3>
                  <p className="text-sm text-gray-500 mb-4">Enter your email and we'll send you a reset link.</p>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="agent@example.com"
                    className={inputClass} />
                </div>
                {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
                <button type="submit" disabled={loading}
                  className="w-full bg-teal-700 hover:bg-teal-800 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 text-sm">
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
                <button type="button" onClick={() => { setMode('login'); setError(''); }}
                  className="w-full text-sm text-teal-600 hover:text-teal-800 font-medium py-1">
                  ← Back to Login
                </button>
              </form>
            )}
          </div>
        )}

        {/* Login / Register View */}
        {mode !== 'forgot' && (
          <>
            {/* Outer tabs: Login / Sign Up */}
            <div className="flex rounded-lg overflow-hidden border border-gray-200 mb-6">
              {(['login', 'register'] as const).map((m) => (
                <button key={m} onClick={() => {
                  setMode(m);
                  setError('');
                  if (m === 'login') setSignUpRole('');
                }}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === m ? 'bg-teal-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                  {m === 'login' ? 'Login' : 'Sign Up'}
                </button>
              ))}
            </div>

            {/* Single Sign Up form with Role selector */}
            {mode === 'register' && (
              <form onSubmit={signUpRole === 'aggregator' ? handleAggregatorSubmit : handleSubmit} className="space-y-4">
                {/* Role selector — must be chosen first */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={signUpRole}
                    onChange={e => setSignUpRole(e.target.value as '' | 'agent' | 'aggregator')}
                    className={inputClass}>
                    <option value="">-- Select Role --</option>
                    <option value="agent">Agent</option>
                    <option value="aggregator">Aggregator</option>
                  </select>
                </div>

                {/* Agent fields */}
                {signUpRole === 'agent' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                      <input type="text" required value={name} onChange={e => setName(e.target.value)}
                        placeholder="Enter your full name" className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Device ID</label>
                      <input type="text" required value={deviceId} onChange={e => setDeviceId(e.target.value.slice(0, 20))}
                        placeholder="HENA-315835789326461" maxLength={20}
                        className={`${inputClass} font-mono`} />
                      <p className="text-xs text-gray-400 mt-1">{deviceId.length}/20 characters</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                      <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="agent@example.com" className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                      <input type="tel" required value={phone}
                        onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                        placeholder="08012345678" className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                      <select required value={agentStateId}
                        onChange={e => {
                          const sel = geoData.find(s => s.id === e.target.value);
                          setAgentStateId(e.target.value); setAgentStateName(sel?.name ?? '');
                          setAgentLgaId(''); setAgentLgaName('');
                        }}
                        className={inputClass}>
                        <option value="">Select state...</option>
                        {geoData.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">LGA</label>
                      <select required disabled={!agentStateId} value={agentLgaId}
                        onChange={e => {
                          const sel = agentLgas.find(l => l.id === e.target.value);
                          setAgentLgaId(e.target.value); setAgentLgaName(sel?.name ?? '');
                        }}
                        className={`${inputClass} disabled:bg-gray-100 disabled:text-gray-400`}>
                        <option value="">Select LGA...</option>
                        {agentLgas.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                      <div className="relative">
                        <input type={showPassword ? 'text' : 'password'} required value={password}
                          onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters"
                          className={`${inputClass} pr-10`} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {eyeIcon(showPassword)}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                      <div className="relative">
                        <input type={showConfirm ? 'text' : 'password'} required value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter your password"
                          className={`${inputClass} pr-10`} />
                        <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {eyeIcon(showConfirm)}
                        </button>
                      </div>
                    </div>
                    {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
                    <button type="submit" disabled={loading}
                      className="w-full bg-teal-700 hover:bg-teal-800 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60">
                      {loading ? 'Please wait...' : 'Create Account'}
                    </button>
                  </>
                )}

                {/* Aggregator fields */}
                {signUpRole === 'aggregator' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                      <input type="text" required value={aggName} onChange={e => setAggName(e.target.value)}
                        placeholder="Enter your full name" className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                      <input type="email" required value={aggEmail} onChange={e => setAggEmail(e.target.value)}
                        placeholder="aggregator@example.com" className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                      <input type="tel" required value={aggPhone}
                        onChange={e => setAggPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                        placeholder="08012345678" className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                      <select required value={aggStateId}
                        onChange={e => {
                          const sel = geoData.find(s => s.id === e.target.value);
                          setAggStateId(e.target.value); setAggStateName(sel?.name ?? '');
                          setAggLgaId(''); setAggLgaName('');
                        }}
                        className={inputClass}>
                        <option value="">Select state...</option>
                        {geoData.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">LGA</label>
                      <select required disabled={!aggStateId} value={aggLgaId}
                        onChange={e => {
                          const sel = aggLgas.find(l => l.id === e.target.value);
                          setAggLgaId(e.target.value); setAggLgaName(sel?.name ?? '');
                        }}
                        className={`${inputClass} disabled:bg-gray-100 disabled:text-gray-400`}>
                        <option value="">Select LGA...</option>
                        {aggLgas.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Office Address</label>
                      <textarea required value={aggOfficeAddress} onChange={e => setAggOfficeAddress(e.target.value)}
                        placeholder="Enter your office address" rows={2}
                        className={`${inputClass} resize-none`} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                      <div className="relative">
                        <input type={aggShowPassword ? 'text' : 'password'} required value={aggPassword}
                          onChange={e => setAggPassword(e.target.value)} placeholder="Min. 6 characters"
                          className={`${inputClass} pr-10`} />
                        <button type="button" onClick={() => setAggShowPassword(!aggShowPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {eyeIcon(aggShowPassword)}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                      <div className="relative">
                        <input type={aggShowConfirm ? 'text' : 'password'} required value={aggConfirmPassword}
                          onChange={e => setAggConfirmPassword(e.target.value)} placeholder="Re-enter your password"
                          className={`${inputClass} pr-10`} />
                        <button type="button" onClick={() => setAggShowConfirm(!aggShowConfirm)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {eyeIcon(aggShowConfirm)}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Invite Code</label>
                      <input type="text" required value={aggInviteCode} onChange={e => setAggInviteCode(e.target.value)}
                        placeholder="Enter your invite code" className={inputClass} />
                      <p className="text-xs text-gray-400 mt-1">Contact the administrator to get your invite code.</p>
                    </div>
                    {aggError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{aggError}</div>}
                    <button type="submit" disabled={aggLoading}
                      className="w-full bg-teal-700 hover:bg-teal-800 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60">
                      {aggLoading ? 'Please wait...' : 'Create Aggregator Account'}
                    </button>
                  </>
                )}
              </form>
            )}

            {/* Login form */}
            {mode === 'login' && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="agent@example.com" className={inputClass} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">Password</label>
                    <button type="button" onClick={() => { setMode('forgot'); setError(''); setResetSent(false); }}
                      className="text-xs text-teal-600 hover:text-teal-800 font-medium">
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} required value={password}
                      onChange={e => setPassword(e.target.value)} placeholder="Enter password"
                      className={`${inputClass} pr-10`} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {eyeIcon(showPassword)}
                    </button>
                  </div>
                </div>
                {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
                <button type="submit" disabled={loading}
                  className="w-full bg-teal-700 hover:bg-teal-800 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60">
                  {loading ? 'Please wait...' : 'Login'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
