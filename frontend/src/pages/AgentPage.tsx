import { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { collection, addDoc, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { loadGeoData, State } from '../geoData';
import Logo from '../components/Logo';

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
  const [tab, setTab] = useState<'form' | 'history' | 'profile'>('form');
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

  useEffect(() => { loadGeoData().then(setGeoData); }, []);

  useEffect(() => {
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.deviceId) { setDeviceId(data.deviceId); savedDeviceId.current = data.deviceId; }
        if (data.phone) setProfilePhone(data.phone);
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

  const selectedState = geoData.find(s => s.id === stateId);
  const selectedLga = selectedState?.lgas.find(l => l.id === lgaId);
  const wards = selectedLga?.wards ?? [];

  useEffect(() => {
    if (tab === 'history') loadHistory();
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

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(''); setProfileSuccess('');
    setProfileSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { phone: profilePhone });
      setProfileSuccess('Profile updated successfully!');
    } catch (err: any) {
      setProfileError('Failed to update: ' + err.message);
    } finally {
      setProfileSaving(false);
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
        <div className="flex gap-2 mb-4">
          {(['form', 'history', 'profile'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t ? 'bg-teal-700 text-white' : 'bg-white text-gray-600 border'}`}>
              {t === 'form' ? 'Submit Enrollment' : t === 'history' ? 'My Submissions' : 'My Profile'}
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
              {profileError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{profileError}</div>}
              {profileSuccess && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2">{profileSuccess}</div>}
              <button type="submit" disabled={profileSaving}
                className="w-full bg-teal-700 hover:bg-teal-800 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 text-sm">
                {profileSaving ? 'Saving...' : 'Save Profile'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
