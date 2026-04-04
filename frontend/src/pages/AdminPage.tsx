import { useState, useEffect } from 'react';
import { User, signOut, createUserWithEmailAndPassword, updateProfile, getAuth, sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, orderBy, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import * as XLSX from 'xlsx';
import { auth, db } from '../firebase';
import Logo from '../components/Logo';

interface Props { user: User; }
interface Enrollment {
  id: string; date: string; stateName: string; lgaName: string; wardName: string;
  deviceId: string; dailyFigures: number; issuesComplaints: string;
  agentName: string; agentEmail: string; submittedAt: string;
}
interface Agent { id: string; name: string; email: string; deviceId?: string; createdAt: string; }

export default function AdminPage({ user: _user }: Props) {
  const [tab, setTab] = useState<'enrollments' | 'agents'>('enrollments');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newRole, setNewRole] = useState<'AGENT' | 'ADMIN'>('AGENT');
  const [addingUser, setAddingUser] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [editAgent, setEditAgent] = useState<Agent | null>(null);
  const [editName, setEditName] = useState('');
  const [editDeviceId, setEditDeviceId] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [resetMsg, setResetMsg] = useState<Record<string, string>>({});

  function loadAgents() {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    getDocs(q).then(snap => {
      setAgents(snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Agent & { role: string }))
        .filter((u: any) => u.role === 'AGENT')
      );
    });
  }

  useEffect(() => {
    setLoading(true);
    if (tab === 'enrollments') {
      const q = query(collection(db, 'enrollments'), orderBy('submittedAt', 'desc'));
      getDocs(q).then(snap => {
        setEnrollments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Enrollment)));
      }).finally(() => setLoading(false));
    } else {
      loadAgents();
      setLoading(false);
    }
  }, [tab]);

  const hasFilters = search || dateFrom || dateTo;
  const filtered = enrollments.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || [r.agentName, r.stateName, r.lgaName, r.wardName, r.deviceId].some(v => v?.toLowerCase().includes(q));
    return matchSearch && (!dateFrom || r.date >= dateFrom) && (!dateTo || r.date <= dateTo);
  });
  const totalFigures = filtered.reduce((sum, r) => sum + (r.dailyFigures || 0), 0);

  function clearFilters() { setSearch(''); setDateFrom(''); setDateTo(''); }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setAddError(''); setAddSuccess('');
    setAddingUser(true);
    try {
      const secondaryApp = initializeApp(auth.app.options, 'secondary-' + Date.now());
      const secondaryAuth = getAuth(secondaryApp);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, newEmail, newPassword);
      await updateProfile(cred.user, { displayName: newName });
      await setDoc(doc(db, 'users', cred.user.uid), {
        name: newName, email: newEmail, role: newRole,
        deviceId: newDeviceId, createdAt: new Date().toISOString(),
      });
      await secondaryAuth.signOut();
      setAddSuccess(`"${newName}" created as ${newRole}.`);
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewDeviceId(''); setNewRole('AGENT');
      loadAgents();
    } catch (err: any) {
      const msg: Record<string, string> = {
        'auth/email-already-in-use': 'Email already registered.',
        'auth/weak-password': 'Password must be at least 6 characters.',
        'auth/invalid-email': 'Invalid email address.',
      };
      setAddError(msg[err.code] || err.message);
    } finally {
      setAddingUser(false);
    }
  }

  async function handleDeleteUser(agentId: string, agentName: string) {
    if (!window.confirm(`Delete "${agentName}"? This removes their profile. Their enrollment records will be preserved.`)) return;
    try {
      await deleteDoc(doc(db, 'users', agentId));
      setAgents(prev => prev.filter(a => a.id !== agentId));
    } catch (err: any) {
      alert('Failed to delete user: ' + err.message);
    }
  }

  function openEdit(a: Agent) {
    setEditAgent(a);
    setEditName(a.name);
    setEditDeviceId(a.deviceId || '');
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editAgent) return;
    setEditSaving(true);
    try {
      await updateDoc(doc(db, 'users', editAgent.id), { name: editName, deviceId: editDeviceId });
      setAgents(prev => prev.map(a => a.id === editAgent.id ? { ...a, name: editName, deviceId: editDeviceId } : a));
      setEditAgent(null);
    } catch (err: any) {
      alert('Failed to update: ' + err.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function handlePasswordReset(agentId: string, email: string) {
    try {
      await sendPasswordResetEmail(auth, email);
      setResetMsg(prev => ({ ...prev, [agentId]: `Reset email sent to ${email}` }));
      setTimeout(() => setResetMsg(prev => { const n = { ...prev }; delete n[agentId]; return n; }), 5000);
    } catch (err: any) {
      alert('Failed to send reset email: ' + err.message);
    }
  }

  function exportExcel() {
    const reportDateRaw = dateFrom || new Date().toISOString().split('T')[0];
    const [yr, mo, dy] = reportDateRaw.split('-');
    const reportDateFormatted = `${dy}/${mo}/${yr}`;
    const fileDate = `${dy}-${mo}-${yr}`;
    const fileName = `2PLUS TECH WARD ENROLLMENT ${fileDate}.xlsx`;
    const wb = XLSX.utils.book_new();
    const wsData: (string | number)[][] = [
      ['Daily Ward Enrollment Report', '', '', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['Name of FEP: 2 PLUS TECHNOLOGIES', '', '', '', 'Date of Reporting: ' + reportDateFormatted, '', ''],
      ['', '', '', '', '', '', ''],
      ['S/No.', 'States', 'Local Govt Areas', 'Ward', 'Device ID', 'Daily Enrolment Figures', 'Issues/Complaint'],
    ];
    filtered.forEach((r, i) => {
      wsData.push([i + 1, r.stateName, r.lgaName, r.wardName, r.deviceId, r.dailyFigures, r.issuesComplaints || '']);
    });
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
      { s: { r: 2, c: 4 }, e: { r: 2, c: 6 } },
    ];
    ws['!cols'] = [{ wch: 6 }, { wch: 20 }, { wch: 25 }, { wch: 25 }, { wch: 18 }, { wch: 22 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, 'FEP WARD ENROLMENT TEMPLATE');
    XLSX.writeFile(wb, fileName);
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Edit Modal */}
      {editAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Edit Agent</h3>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input type="text" required value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Device ID</label>
                <input type="text" value={editDeviceId} onChange={e => setEditDeviceId(e.target.value.slice(0, 22))}
                  placeholder="HENA-315835789326461" maxLength={22}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono" />
                <p className="text-xs text-gray-400 mt-1">{editDeviceId.length}/22 characters</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="text" value={editAgent.email} disabled
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={editSaving}
                  className="flex-1 bg-teal-700 hover:bg-teal-800 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 text-sm">
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setEditAgent(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-lg transition-colors text-sm">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <header className="bg-teal-800 text-white px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <Logo size={38} />
          <div>
            <div className="font-black text-sm leading-tight">
              <span className="text-pink-300">2 PLUS </span><span className="text-teal-200">TECHNOLOGIES</span>
            </div>
            <div className="text-teal-300 text-xs">NIMC Ward Enrollment · Admin</div>
          </div>
        </div>
        <button onClick={() => signOut(auth)} className="text-sm bg-teal-700 hover:bg-teal-600 px-3 py-1.5 rounded-lg">Logout</button>
      </header>

      <div className="max-w-7xl mx-auto p-4">
        <div className="flex gap-2 mb-5">
          {(['enrollments', 'agents'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm ${tab === t ? 'bg-teal-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}>
              {t === 'enrollments' ? '📋 Enrollment Records' : '👥 Agents'}
            </button>
          ))}
        </div>

        {tab === 'enrollments' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
            <div className="p-5 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Enrollment Records</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {filtered.length} record{filtered.length !== 1 ? 's' : ''} ·
                    <span className="text-teal-600 font-semibold"> {totalFigures.toLocaleString()} total enrollees</span>
                  </p>
                </div>
                <button onClick={exportExcel}
                  className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export Excel
                </button>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[180px]">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input type="text" placeholder="Search agent, state, LGA, ward..." value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-50" />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-gray-500">From</span>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-50" />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-gray-500">To</span>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-50" />
                </div>
                {hasFilters && (
                  <button onClick={clearFilters}
                    className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors font-medium">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <svg className="animate-spin h-6 w-6 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Loading records...
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="font-medium">No records found</p>
                {hasFilters && <p className="text-sm mt-1">Try clearing the filters</p>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Date', 'Agent', 'Location', 'Device ID', 'Enrollees', 'Issues'].map((h, i) => (
                        <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${i === 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map((r, i) => (
                      <tr key={r.id} className={`hover:bg-teal-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <td className="px-4 py-3.5 whitespace-nowrap font-medium text-gray-700">{r.date}</td>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-gray-800">{r.agentName}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{r.agentEmail}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="text-gray-700">{r.wardName}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{r.lgaName} · {r.stateName}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{r.deviceId}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className="inline-flex items-center justify-center bg-teal-100 text-teal-800 font-bold text-sm px-3 py-1 rounded-full">
                            {r.dailyFigures?.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 max-w-[200px]">
                          {r.issuesComplaints
                            ? <span className="text-orange-600 text-xs bg-orange-50 px-2 py-1 rounded-full">{r.issuesComplaints.length > 40 ? r.issuesComplaints.slice(0, 40) + '…' : r.issuesComplaints}</span>
                            : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'agents' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Add New User</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Create an agent or admin account</p>
                </div>
                <button onClick={() => { setShowAddUser(!showAddUser); setAddError(''); setAddSuccess(''); }}
                  className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${showAddUser ? 'bg-gray-100 text-gray-600' : 'bg-teal-700 text-white hover:bg-teal-800'}`}>
                  {showAddUser ? '✕ Cancel' : '+ Add User'}
                </button>
              </div>
              {showAddUser && (
                <form onSubmit={handleAddUser} className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input type="text" required value={newName} onChange={e => setNewName(e.target.value)} placeholder="Enter full name" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <input type="email" required value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@example.com" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 6 characters" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Device ID <span className="text-gray-400">(optional)</span></label>
                    <input type="text" value={newDeviceId} onChange={e => setNewDeviceId(e.target.value.slice(0, 22))}
                      placeholder="HENA-315835789326461" maxLength={22}
                      className={inputCls + ' font-mono'} />
                    <p className="text-xs text-gray-400 mt-1">{newDeviceId.length}/22 characters</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select value={newRole} onChange={e => setNewRole(e.target.value as 'AGENT' | 'ADMIN')} className={inputCls}>
                      <option value="AGENT">Agent</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    {addError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-3">{addError}</div>}
                    {addSuccess && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2 mb-3">{addSuccess}</div>}
                    <button type="submit" disabled={addingUser}
                      className="bg-teal-700 hover:bg-teal-800 text-white font-medium px-6 py-2.5 rounded-lg transition-colors disabled:opacity-60 text-sm">
                      {addingUser ? 'Creating...' : 'Create User'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
              <div className="p-5 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">Registered Agents</h2>
                <p className="text-sm text-gray-500 mt-0.5">{agents.length} agent{agents.length !== 1 ? 's' : ''}</p>
              </div>
              {agents.length === 0 ? (
                <div className="text-center py-16 text-gray-400">No agents registered yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Agent</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Device ID</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Registered</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {agents.map((a, i) => (
                        <tr key={a.id} className={`hover:bg-teal-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm">
                                {a.name?.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-semibold text-gray-800">{a.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-gray-500">{a.email}</td>
                          <td className="px-4 py-3.5">
                            <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{a.deviceId || '—'}</span>
                          </td>
                          <td className="px-4 py-3.5 text-gray-400 text-xs">{new Date(a.createdAt).toLocaleDateString('en-NG', { dateStyle: 'medium' })}</td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex gap-1.5">
                                <button onClick={() => openEdit(a)}
                                  className="text-xs text-teal-600 hover:text-teal-800 border border-teal-200 hover:border-teal-400 bg-teal-50 hover:bg-teal-100 px-2.5 py-1.5 rounded-lg transition-colors font-medium">
                                  Edit
                                </button>
                                <button onClick={() => handlePasswordReset(a.id, a.email)}
                                  className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors font-medium">
                                  Reset Password
                                </button>
                                <button onClick={() => handleDeleteUser(a.id, a.name)}
                                  className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors font-medium">
                                  Delete
                                </button>
                              </div>
                              {resetMsg[a.id] && (
                                <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">{resetMsg[a.id]}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
