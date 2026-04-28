import { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { collection, addDoc, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { loadGeoData, State } from '../geoData';
import Logo from '../components/Logo';
import { EnrollmentLog, formatMonthName, sortEnrollmentLogs } from '../enrollmentLogUtils';

interface Props { user: User; }

interface Record {
  id: string;
  date: string;
  stateName: string;
  lgaName: string;
  wardName: string;
  deviceId: string;
  dailyFigures: number;
  issuesComplaints: string;
  submittedAt: string;
}

export default function AgentPage({ user }: Props) {
  const [tab, setTab] = useState<'form' | 'history' | 'profile' | 'enrollmentLog' | 'accountDetails'>('form');
  const [geoData, setGeoData] = useState<State[]>([]);
  const [stateId, setStateId] = useState('');
  const [lgaId, setLgaId] = useState('');
  const [wardId, setWardId] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const savedDeviceId = useRef('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  // Profile — State/LGA
  const [profileStateId, setProfileStateId] = useState('');
  const [profileStateName, setProfileStateName] = useState('');
  const [profileLgaId, setProfileLgaId] = useState('');
  const [profileLgaName, setProfileLgaName] = useState('');
  // Account Details tab
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [accountSuccess, setAccountSuccess] = useState('');
  const [accountLocked, setAccountLocked] = useState(false);

  useEffect(() => { loadGeoData().then(setGeoData); }, []);

  useEffect(() => {
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.deviceId) { setDeviceId(data.deviceId); savedDeviceId.current = data.deviceId; }
        if (data.phone) setProfilePhone(data.phone);
        if (data.profileStateId) setProfileStateId(data.profileStateId);
        if (data.profileStateName) setProfileStateName(data.profileStateName);
        if (data.profileLgaId) setProfileLgaId(data.profileLgaId);
        if (data.profileLgaName) setProfileLgaName(data.profileLgaName);
        if (data.accountNumber) setAccountNumber(data.accountNumber);
        if (data.accountName) setAccountName(data.accountName);
        if (data.bankName) setBankName(data.bankName);
        if (data.accountLocked) setAccountLocked(true);
      }
    });
  }, [user.uid]);
  const [dailyFigures, setDailyFigures] = useState('');
  const [issues, setIssues] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState<Record[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [enrollmentLogs, setEnrollmentLogs] = useState<EnrollmentLog[]>([]);
  const [loadingEnrollmentLogs, setLoadingEnrollmentLogs] = useState(false);

  const selectedState = geoData.find(s => s.id === stateId);
  const selectedLga = selectedState?.lgas.find(l => l.id === lgaId);
  const wards = selectedLga?.wards ?? [];

  useEffect(() => {
    if (tab === 'history') loadHistory();
    if (tab === 'enrollmentLog') loadEnrollmentLogs();
  }, [tab]);

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, 'enrollments'),
        where('agentId', '==', user.uid)
      );
      const snap = await getDocs(q);
      const records = snap.docs.map(d => ({ id: d.id, ...d.data() } as Record));
      // Sort client-side to avoid needing a composite Firestore index
      records.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
      setHistory(records);
    } catch (err: any) {
      console.error('Failed to load history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function loadEnrollmentLogs() {
    setLoadingEnrollmentLogs(true);
    try {
      const q = query(
        collection(db, 'enrollmentLogs'),
        where('agentId', '==', user.uid)
      );
      const snap = await getDocs(q);
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() } as EnrollmentLog));
      setEnrollmentLogs(sortEnrollmentLogs(logs));
    } catch (err: any) {
      console.error('Failed to load enrollment logs:', err);
    } finally {
      setLoadingEnrollmentLogs(false);
    }
  }

  const profileSelectedState = geoData.find(s => s.id === profileStateId);
  const profileLgas = profileSelectedState?.lgas ?? [];

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(''); setProfileSuccess('');
    setProfileSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        phone: profilePhone,
        profileStateId,
        profileStateName,
        profileLgaId,
        profileLgaName,
      });
      setProfileSuccess('Profile updated successfully!');
    } catch (err: any) {
      setProfileError('Failed to update: ' + err.message);
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleAccountSave(e: React.FormEvent) {
    e.preventDefault();
    setAccountError(''); setAccountSuccess('');
    if (!accountNumber.trim() || !accountName.trim() || !bankName.trim()) {
      setAccountError('All three fields are required.');
      return;
    }
    setAccountSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { accountNumber, accountName, bankName, accountLocked: true });
      setAccountSuccess('Account details saved successfully!');
      setAccountLocked(true);
    } catch (err: any) {
      setAccountError('Failed to save: ' + err.message);
    } finally {
      setAccountSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!stateId || !lgaId || !wardId) { setError('Please select State, LGA, and Ward.'); return; }
    setSubmitting(true);
    try {
      const state = geoData.find((s: State) => s.id === stateId)!;
      const lga = state.lgas.find((l: { id: string; name: string }) => l.id === lgaId)!;
      const ward = lga.wards.find((w: { id: string; name: string }) => w.id === wardId)!;
      await addDoc(collection(db, 'enrollments'), {
        date,
        stateId, stateName: state.name,
        lgaId, lgaName: lga.name,
        wardId, wardName: ward.name,
        deviceId,
        dailyFigures: Number(dailyFigures),
        issuesComplaints: issues,
        agentId: user.uid,
        agentName: user.displayName || user.email,
        agentEmail: user.email,
        submittedAt: new Date().toISOString(),
      });
      setSuccess('Enrollment submitted successfully!');
      setDailyFigures(''); setIssues('');
      if (savedDeviceId.current) setDeviceId(savedDeviceId.current);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fullscreen submission loader */}
      {submitting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm">
          <div className="animate-float flex flex-col items-center gap-4">
            <Logo size={80} />
            <p className="text-teal-700 font-semibold text-sm tracking-wide">Submitting enrollment...</p>
          </div>
        </div>
      )}
      <header className="bg-teal-800 text-white px-4 py-3 flex items-center justify-between shadow">
        <div className="flex items-center gap-3">
          <Logo size={38} />
          <div>
            <div className="font-black text-sm leading-tight">
              <span className="text-pink-300">2 PLUS </span>
              <span className="text-teal-200">TECHNOLOGIES</span>
            </div>
            <div className="text-teal-300 text-xs">NIMC Ward Enrollment · {user.displayName || user.email}</div>
          </div>
        </div>
        <button onClick={() => signOut(auth)} className="text-sm bg-teal-700 hover:bg-teal-600 px-3 py-1.5 rounded-lg">
          Logout
        </button>
      </header>

      <div className="max-w-2xl mx-auto p-4">
        <div className="flex flex-wrap gap-2 mb-4">
          {(['form', 'history', 'profile', 'enrollmentLog', 'accountDetails'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t ? 'bg-teal-700 text-white' : 'bg-white text-gray-600 border'}`}>
              {t === 'form' ? 'Submit Enrollment' : t === 'history' ? 'My Submissions' : t === 'profile' ? 'My Profile' : t === 'enrollmentLog' ? '📊 Enrollment Log' : '🏦 Account Details'}
            </button>
          ))}
        </div>

        {tab === 'form' && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Daily Enrollment Form</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" required value={date} onChange={e => setDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <select required value={stateId} onChange={e => { setStateId(e.target.value); setLgaId(''); setWardId(''); }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="">-- Select State --</option>
                  {geoData.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Local Government Area</label>
                <select required value={lgaId} onChange={e => { setLgaId(e.target.value); setWardId(''); }} disabled={!stateId}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100">
                  <option value="">-- Select LGA --</option>
                  {(selectedState?.lgas ?? []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ward</label>
                <select required value={wardId} onChange={e => setWardId(e.target.value)} disabled={!lgaId}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100">
                  <option value="">-- Select Ward --</option>
                  {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Device ID</label>
                <input type="text" required value={deviceId} onChange={e => setDeviceId(e.target.value)}
                  placeholder="e.g. NIN-DEV-00123"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Daily Enrollment Figures</label>
                <input type="number" required min="0" value={dailyFigures} onChange={e => setDailyFigures(e.target.value)}
                  placeholder="Number of enrollments today"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Issues / Complaints <span className="text-gray-400">(optional)</span></label>
                <textarea value={issues} onChange={e => setIssues(e.target.value)} rows={3}
                  placeholder="Describe any issues or complaints..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
              </div>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
              {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2">{success}</div>}
              <button type="submit" disabled={submitting}
                className="w-full bg-teal-700 hover:bg-teal-800 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60">
                Submit Enrollment
              </button>
            </form>
          </div>
        )}

        {tab === 'history' && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">My Submissions</h2>
            {loadingHistory ? (
              <p className="text-gray-400 text-sm text-center py-8">Loading...</p>
            ) : history.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No submissions yet.</p>
            ) : (
              <div className="space-y-3">
                {history.map(r => (
                  <div key={r.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-gray-800">{r.date}</div>
                        <div className="text-sm text-gray-500">{r.stateName} › {r.lgaName} › {r.wardName}</div>
                      </div>
                      <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">{r.dailyFigures} enrolled</span>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">Device: {r.deviceId}</div>
                    {r.issuesComplaints && <div className="mt-1 text-xs text-orange-600">Issues: {r.issuesComplaints}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {tab === 'profile' && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">My Profile</h2>
            <p className="text-sm text-gray-500 mb-5">Update your contact information.</p>
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input type="text" value={user.displayName || ''} disabled
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input type="text" value={user.email || ''} disabled
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input type="tel" value={profilePhone}
                  onChange={e => setProfilePhone(e.target.value.replace(/[^0-9+\-\s()]/g, '').slice(0, 15))}
                  placeholder="+234 800 000 0000"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <select
                  value={profileStateId}
                  onChange={e => {
                    const selected = geoData.find(s => s.id === e.target.value);
                    setProfileStateId(selected?.id ?? '');
                    setProfileStateName(selected?.name ?? '');
                    setProfileLgaId('');
                    setProfileLgaName('');
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                  <option value="">-- Select State --</option>
                  {geoData.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Local Government Area</label>
                <select
                  value={profileLgaId}
                  onChange={e => {
                    const selected = profileLgas.find(l => l.id === e.target.value);
                    setProfileLgaId(selected?.id ?? '');
                    setProfileLgaName(selected?.name ?? '');
                  }}
                  disabled={!profileStateId}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-100">
                  <option value="">-- Select LGA --</option>
                  {profileLgas.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              {profileError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{profileError}</div>}
              {profileSuccess && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2">{profileSuccess}</div>}
              <button type="submit" disabled={profileSaving}
                className="w-full bg-teal-700 hover:bg-teal-800 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 text-sm">
                {profileSaving ? 'Saving...' : 'Save Profile'}
              </button>
            </form>
          </div>
        )}

        {tab === 'accountDetails' && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Account Details</h2>
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3 mb-5 flex items-start gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <span>⚠️ Your bank account name must match the name registered with the company. Please enter your account details carefully.</span>
            </div>

            {accountLocked ? (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-lg px-4 py-3 flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Your account details have been submitted and are now locked. To make changes, please contact the admin.</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                  <input type="text" value={accountNumber} disabled
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                  <input type="text" value={accountName} disabled
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                  <input type="text" value={bankName} disabled
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500" />
                </div>
              </div>
            ) : (
              <form onSubmit={handleAccountSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    value={accountNumber}
                    onChange={e => setAccountNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                    placeholder="10-digit account number"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                  <input
                    type="text"
                    maxLength={100}
                    value={accountName}
                    onChange={e => setAccountName(e.target.value)}
                    placeholder="Name on your bank account"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    maxLength={100}
                    value={bankName}
                    onChange={e => setBankName(e.target.value)}
                    placeholder="e.g. First Bank, GTBank"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                {accountError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{accountError}</div>}
                {accountSuccess && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2">{accountSuccess}</div>}
                <button type="submit" disabled={accountSaving}
                  className="w-full bg-teal-700 hover:bg-teal-800 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 text-sm">
                  {accountSaving ? 'Saving...' : 'Save Account Details'}
                </button>
              </form>
            )}
          </div>
        )}

        {tab === 'enrollmentLog' && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Enrollment Log</h2>
            <p className="text-sm text-gray-500 mb-5">Your monthly enrollment totals recorded by the admin.</p>
            {loadingEnrollmentLogs ? (
              <div className="flex items-center justify-center py-10 text-gray-400 gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Loading...
              </div>
            ) : enrollmentLogs.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No enrollment log entries yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Month</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Year</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Enrollment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {enrollmentLogs.map((log, i) => (
                      <tr key={log.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-teal-50 transition-colors`}>
                        <td className="px-4 py-3.5 font-medium text-gray-700">{formatMonthName(log.month)}</td>
                        <td className="px-4 py-3.5 text-gray-600">{log.year}</td>
                        <td className="px-4 py-3.5 text-right">
                          <span className="inline-flex items-center justify-center bg-teal-100 text-teal-800 font-bold text-sm px-3 py-1 rounded-full">
                            {log.totalEnrollment.toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
