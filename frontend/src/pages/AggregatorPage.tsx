import { useState, useEffect } from 'react';
import { User, signOut } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, runTransaction } from 'firebase/firestore';
import { auth, db } from '../firebase';
import Logo from '../components/Logo';
import { EnrollmentLog, formatMonthName, sortEnrollmentLogs } from '../enrollmentLogUtils';
import {
  AgentUser,
  filterUnlinkedAgents,
  chunkArray,
  scopeEnrollmentsByAgentUids,
  computeEnrollmentTotal,
} from '../aggregatorUtils';

interface Props { user: User; }

type AggregatorTab = 'agents' | 'linkAgent' | 'reports' | 'enrollmentLog' | 'profile';

interface Enrollment {
  id: string;
  date: string;
  stateName: string;
  lgaName: string;
  wardName: string;
  deviceId: string;
  dailyFigures: number;
  issuesComplaints: string;
  agentName: string;
  agentEmail: string;
  submittedAt: string;
  agentId: string;
}

export default function AggregatorPage({ user }: Props) {
  const [tab, setTab] = useState<AggregatorTab>('agents');
  const [myAgents, setMyAgents] = useState<AgentUser[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [aggregatorDisplayId, setAggregatorDisplayId] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [_profilePhone, setProfilePhone] = useState('');
  const [linkSearch, setLinkSearch] = useState('');
  const [linkResults, setLinkResults] = useState<AgentUser[]>([]);
  const [linkSearching, setLinkSearching] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [reportDateFrom, setReportDateFrom] = useState('');
  const [reportDateTo, setReportDateTo] = useState('');
  const [reportSearch, setReportSearch] = useState('');
  const [enrollmentLogs, setEnrollmentLogs] = useState<EnrollmentLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  useEffect(() => {
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.aggregatorId) setAggregatorDisplayId(data.aggregatorId);
        if (data.name) setProfileName(data.name);
        if (data.email) setProfileEmail(data.email);
        if (data.phone) { setProfilePhone(data.phone); setEditPhone(data.phone); }
      }
    });
    loadAgents();
  }, [user.uid]);

  async function loadAgents() {
    setLoadingAgents(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('aggregatorId', '==', user.uid),
        where('role', '==', 'AGENT')
      );
      const snap = await getDocs(q);
      const agents = snap.docs.map(d => ({ id: d.id, ...d.data() } as AgentUser));
      setMyAgents(agents);
    } catch (err) {
      console.error('Failed to load agents:', err);
    } finally {
      setLoadingAgents(false);
    }
  }

  useEffect(() => {
    if (tab === 'reports') loadEnrollments();
    if (tab === 'enrollmentLog') loadEnrollmentLogs();
  }, [tab]);

  async function loadEnrollments() {
    if (myAgents.length === 0) return;
    setLoadingEnrollments(true);
    try {
      const agentUids = myAgents.map(a => a.id);
      const batches = chunkArray(agentUids, 30);
      const results = await Promise.all(
        batches.map(batch =>
          getDocs(query(collection(db, 'enrollments'), where('agentId', 'in', batch)))
        )
      );
      const raw = results.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as Enrollment)));
      setEnrollments(scopeEnrollmentsByAgentUids(raw, agentUids));
    } catch (err) {
      console.error('Failed to load enrollments:', err);
    } finally {
      setLoadingEnrollments(false);
    }
  }

  async function loadEnrollmentLogs() {
    if (myAgents.length === 0) return;
    setLoadingLogs(true);
    try {
      const agentUids = myAgents.map(a => a.id);
      const batches = chunkArray(agentUids, 30);
      const results = await Promise.all(
        batches.map(batch =>
          getDocs(query(collection(db, 'enrollmentLogs'), where('agentId', 'in', batch)))
        )
      );
      const raw = results.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as EnrollmentLog)));
      const scoped = scopeEnrollmentsByAgentUids(raw, agentUids);
      setEnrollmentLogs(sortEnrollmentLogs(scoped));
    } catch (err) {
      console.error('Failed to load enrollment logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  }

  async function handleLinkSearch(e: React.FormEvent) {
    e.preventDefault();
    setLinkError(''); setLinkResults([]);
    setLinkSearching(true);
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'AGENT'));
      const snap = await getDocs(q);
      const allAgents = snap.docs.map(d => ({ id: d.id, ...d.data() } as AgentUser));
      setLinkResults(filterUnlinkedAgents(allAgents, linkSearch));
    } catch (err: any) {
      setLinkError('Search failed: ' + err.message);
    } finally {
      setLinkSearching(false);
    }
  }

  async function handleLinkAgent(agentId: string) {
    setLinkingId(agentId);
    setLinkError('');
    try {
      await runTransaction(db, async (tx) => {
        const agentRef = doc(db, 'users', agentId);
        const snap = await tx.get(agentRef);
        if (!snap.exists()) throw new Error('Agent not found.');
        const data = snap.data();
        if (data.aggregatorId) throw new Error('This agent is already linked to another aggregator.');
        tx.update(agentRef, { aggregatorId: user.uid });
      });
      const linked = linkResults.find(a => a.id === agentId);
      if (linked) {
        setMyAgents(prev => [{ ...linked, aggregatorId: user.uid }, ...prev]);
        setLinkResults(prev => prev.filter(a => a.id !== agentId));
      }
    } catch (err: any) {
      setLinkError(err.message || 'Failed to link agent.');
    } finally {
      setLinkingId(null);
    }
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(''); setProfileSuccess('');
    setProfileSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { phone: editPhone });
      setProfilePhone(editPhone);
      setProfileSuccess('Profile updated successfully!');
    } catch (err: any) {
      setProfileError('Failed to update profile: ' + err.message);
    } finally {
      setProfileSaving(false);
    }
  }

  const filteredEnrollments = enrollments.filter(r => {
    const matchDate = (!reportDateFrom || r.date >= reportDateFrom) && (!reportDateTo || r.date <= reportDateTo);
    const matchSearch = !reportSearch || r.agentName.toLowerCase().includes(reportSearch.toLowerCase());
    return matchDate && matchSearch;
  });
  const enrollmentTotal = computeEnrollmentTotal(filteredEnrollments);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-teal-800 text-white px-4 py-3 flex items-center justify-between shadow">
        <div className="flex items-center gap-3">
          <Logo size={38} />
          <div>
            <div className="font-black text-sm leading-tight">
              <span className="text-pink-300">2 PLUS </span>
              <span className="text-teal-200">TECHNOLOGIES</span>
            </div>
            <div className="text-teal-300 text-xs">NIMC Ward Enrollment  {user.displayName || user.email}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {aggregatorDisplayId && (
            <span className="bg-teal-600 text-teal-100 text-xs font-mono font-semibold px-3 py-1.5 rounded-lg border border-teal-500">
              {aggregatorDisplayId}
            </span>
          )}
          <button onClick={() => signOut(auth)} className="text-sm bg-teal-700 hover:bg-teal-600 px-3 py-1.5 rounded-lg">
            Logout
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4">
        <div className="flex flex-wrap gap-2 mb-4">
          {([
            ['agents', 'My Agents'],
            ['linkAgent', 'Link Agent'],
            ['reports', 'Enrollment Reports'],
            ['enrollmentLog', 'Enrollment Log'],
            ['profile', 'My Profile'],
          ] as [AggregatorTab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={"px-4 py-2 rounded-lg text-sm font-medium " + (tab === t ? 'bg-teal-700 text-white' : 'bg-white text-gray-600 border')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* MY AGENTS TAB */}
        {tab === 'agents' && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">My Agents</h2>
            <p className="text-sm text-gray-500 mb-5">Agents linked to your aggregator account.</p>
            {loadingAgents ? (
              <div className="flex items-center justify-center py-10 text-gray-400 gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Loading...
              </div>
            ) : myAgents.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No agents linked yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Device ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {myAgents.map((agent, i) => (
                      <tr key={agent.id} className={(i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50') + ' hover:bg-teal-50 transition-colors'}>
                        <td className="px-4 py-3.5 font-medium text-gray-800">{agent.name}</td>
                        <td className="px-4 py-3.5 text-gray-600">{agent.email}</td>
                        <td className="px-4 py-3.5 font-mono text-gray-600 text-xs">{agent.deviceId || ''}</td>
                        <td className="px-4 py-3.5 text-gray-600">{agent.phone || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* LINK AGENT TAB */}
        {tab === 'linkAgent' && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Link Agent</h2>
            <p className="text-sm text-gray-500 mb-5">Search for registered agents by name, email, or Device ID and link them to your account.</p>
            <form onSubmit={handleLinkSearch} className="flex gap-2 mb-4">
              <input
                type="text"
                value={linkSearch}
                onChange={e => setLinkSearch(e.target.value)}
                placeholder="Search by name, email, or Device ID..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button type="submit" disabled={linkSearching}
                className="bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60">
                {linkSearching ? 'Searching...' : 'Search'}
              </button>
            </form>
            {linkError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-4">{linkError}</div>}
            {linkResults.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Device ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {linkResults.map((agent, i) => (
                      <tr key={agent.id} className={(i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50') + ' hover:bg-teal-50 transition-colors'}>
                        <td className="px-4 py-3.5 font-medium text-gray-800">{agent.name}</td>
                        <td className="px-4 py-3.5 text-gray-600">{agent.email}</td>
                        <td className="px-4 py-3.5 font-mono text-gray-600 text-xs">{agent.deviceId || ''}</td>
                        <td className="px-4 py-3.5 text-gray-600">{agent.phone || ''}</td>
                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => handleLinkAgent(agent.id)}
                            disabled={linkingId === agent.id}
                            className="bg-teal-700 hover:bg-teal-800 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-60"
                          >
                            {linkingId === agent.id ? 'Linking...' : 'Link'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!linkSearching && linkResults.length === 0 && linkSearch && (
              <p className="text-gray-500 text-sm text-center py-6">No unlinked agents found matching your search.</p>
            )}
          </div>
        )}

        {/* ENROLLMENT REPORTS TAB */}
        {tab === 'reports' && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Enrollment Reports</h2>
            <p className="text-sm text-gray-500 mb-5">Daily enrollment records from your linked agents.</p>
            {myAgents.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No agents linked. Add agents to view their enrollment reports.</p>
            ) : loadingEnrollments ? (
              <div className="flex items-center justify-center py-10 text-gray-400 gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Loading...
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-3 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                    <input type="date" value={reportDateFrom} onChange={e => setReportDateFrom(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                    <input type="date" value={reportDateTo} onChange={e => setReportDateTo(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <div className="flex-1 min-w-48">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Agent Name</label>
                    <input type="text" value={reportSearch} onChange={e => setReportSearch(e.target.value)}
                      placeholder="Search by agent name..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                </div>
                <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
                  <span className="text-sm text-teal-700 font-medium">Total Enrollments</span>
                  <span className="text-lg font-bold text-teal-800">{enrollmentTotal.toLocaleString()}</span>
                </div>
                {filteredEnrollments.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-6">No enrollment records found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Agent Name</th>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">State</th>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">LGA</th>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ward</th>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Device ID</th>
                          <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Daily Figures</th>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Issues</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredEnrollments.map((r, i) => (
                          <tr key={r.id} className={(i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50') + ' hover:bg-teal-50 transition-colors'}>
                            <td className="px-3 py-3 text-gray-700">{r.date}</td>
                            <td className="px-3 py-3 font-medium text-gray-800">{r.agentName}</td>
                            <td className="px-3 py-3 text-gray-600">{r.stateName}</td>
                            <td className="px-3 py-3 text-gray-600">{r.lgaName}</td>
                            <td className="px-3 py-3 text-gray-600">{r.wardName}</td>
                            <td className="px-3 py-3 font-mono text-gray-600 text-xs">{r.deviceId}</td>
                            <td className="px-3 py-3 text-right">
                              <span className="inline-flex items-center justify-center bg-green-100 text-green-800 font-bold text-xs px-2 py-1 rounded-full">
                                {r.dailyFigures}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-gray-500 text-xs">{r.issuesComplaints || ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ENROLLMENT LOG TAB */}
        {tab === 'enrollmentLog' && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Enrollment Log</h2>
            <p className="text-sm text-gray-500 mb-5">Monthly enrollment totals for your linked agents.</p>
            {myAgents.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No agents linked. Add agents to view their enrollment log.</p>
            ) : loadingLogs ? (
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
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Agent Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Month</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Year</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Enrollment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {enrollmentLogs.map((log, i) => (
                      <tr key={log.id} className={(i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50') + ' hover:bg-teal-50 transition-colors'}>
                        <td className="px-4 py-3.5 font-medium text-gray-800">{log.agentName}</td>
                        <td className="px-4 py-3.5 text-gray-700">{formatMonthName(log.month)}</td>
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

        {/* MY PROFILE TAB */}
        {tab === 'profile' && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">My Profile</h2>
            <p className="text-sm text-gray-500 mb-5">View your aggregator details and update your phone number.</p>
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input type="text" value={profileName || user.displayName || ''} disabled
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input type="text" value={profileEmail || user.email || ''} disabled
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aggregator ID</label>
                <div className="flex items-center gap-2">
                  {aggregatorDisplayId ? (
                    <span className="inline-block bg-teal-100 text-teal-800 font-mono font-semibold text-sm px-4 py-2 rounded-lg border border-teal-200">
                      {aggregatorDisplayId}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-sm">Not assigned yet</span>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input type="tel" value={editPhone}
                  onChange={e => setEditPhone(e.target.value.replace(/[^0-9+\-\s()]/g, '').slice(0, 15))}
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
