import { useState, useEffect } from 'react';
import { User, signOut, createUserWithEmailAndPassword, updateProfile, getAuth, sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, orderBy, getDocs, doc, setDoc, deleteDoc, updateDoc, addDoc, where } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import * as XLSX from 'xlsx';
import { auth, db } from '../firebase';
import Logo from '../components/Logo';
import {
  filterAgentsByDeviceId,
  buildEnrollmentLogDocument,
  buildEnrollmentLogPatch,
  formatMonthName,
  sortEnrollmentLogs,
  EnrollmentLog,
} from '../enrollmentLogUtils';

interface Props { user: User; }
interface Enrollment {
  id: string; date: string; stateName: string; lgaName: string; wardName: string;
  deviceId: string; dailyFigures: number; issuesComplaints: string;
  agentName: string; agentEmail: string; submittedAt: string;
}
interface Agent { id: string; name: string; email: string; deviceId?: string; phone?: string; createdAt: string; accountNumber?: string; accountName?: string; bankName?: string; accountLocked?: boolean; }

export default function AdminPage({ user: _user }: Props) {
  const [tab, setTab] = useState<'enrollments' | 'agents' | 'enrollmentLog' | 'accountDetails'>('enrollments');
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
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<'AGENT' | 'ADMIN'>('AGENT');
  const [addingUser, setAddingUser] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [editAgent, setEditAgent] = useState<Agent | null>(null);
  const [editName, setEditName] = useState('');
  const [editDeviceId, setEditDeviceId] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [resetMsg, setResetMsg] = useState<Record<string, string>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const [agentPage, setAgentPage] = useState(0);
  const AGENT_PAGE_SIZE = 20;
  const [editEnrollment, setEditEnrollment] = useState<Enrollment | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editDailyFigures, setEditDailyFigures] = useState('');
  const [editIssues, setEditIssues] = useState('');
  const [editEnrollmentSaving, setEditEnrollmentSaving] = useState(false);

  // --- Enrollment Log state ---
  const [enrollmentLogsByAgent, setEnrollmentLogsByAgent] = useState<Record<string, EnrollmentLog[]>>({});
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [loadingLogsForAgent, setLoadingLogsForAgent] = useState<string | null>(null);
  const [deviceIdSearch, setDeviceIdSearch] = useState('');
  const [enrollmentLogPage, setEnrollmentLogPage] = useState(0);
  const ENROLLMENT_LOG_PAGE_SIZE = 20;
  // Add Log Form
  const [addLogAgent, setAddLogAgent] = useState<Agent | null>(null);
  const [addLogMonth, setAddLogMonth] = useState('1');
  const [addLogYear, setAddLogYear] = useState(String(new Date().getFullYear()));
  const [addLogTotal, setAddLogTotal] = useState('');
  const [addLogSaving, setAddLogSaving] = useState(false);
  const [addLogError, setAddLogError] = useState('');
  const [addLogSuccess, setAddLogSuccess] = useState('');
  // Edit Log Form
  const [editLog, setEditLog] = useState<EnrollmentLog | null>(null);
  const [editLogMonth, setEditLogMonth] = useState('1');
  const [editLogYear, setEditLogYear] = useState('');
  const [editLogTotal, setEditLogTotal] = useState('');
  const [editLogSaving, setEditLogSaving] = useState(false);
  const [editLogError, setEditLogError] = useState('');

  // --- Account Details tab state ---
  const [accountAgents, setAccountAgents] = useState<Agent[]>([]);
  const [loadingAccountAgents, setLoadingAccountAgents] = useState(false);
  const [accountAgentsError, setAccountAgentsError] = useState('');
  const [accountDeviceIdSearch, setAccountDeviceIdSearch] = useState('');
  const [accountPage, setAccountPage] = useState(0);
  const ACCOUNT_PAGE_SIZE = 20;
  // Edit account details modal
  const [editAccountAgent, setEditAccountAgent] = useState<Agent | null>(null);
  const [editAccountNumber, setEditAccountNumber] = useState('');
  const [editAccountName, setEditAccountName] = useState('');
  const [editBankName, setEditBankName] = useState('');
  const [editAccountSaving, setEditAccountSaving] = useState(false);
  const [editAccountError, setEditAccountError] = useState('');

  function loadAgents() {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    getDocs(q).then(snap => {
      setAgents(snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Agent & { role: string }))
        .filter((u: any) => u.role === 'AGENT')
      );
    });
  }

  async function loadAccountAgents() {
    setLoadingAccountAgents(true);
    setAccountAgentsError('');
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'AGENT'));
      const snap = await getDocs(q);
      setAccountAgents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Agent)));
    } catch (err: any) {
      setAccountAgentsError('Failed to load agents: ' + err.message);
    } finally {
      setLoadingAccountAgents(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    if (tab === 'enrollments') {
      const q = query(collection(db, 'enrollments'), orderBy('submittedAt', 'desc'));
      getDocs(q).then(snap => {
        setEnrollments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Enrollment)));
      }).finally(() => setLoading(false));
    } else {
      if (tab === 'accountDetails' && accountAgents.length === 0) loadAccountAgents();
      if (agents.length === 0) loadAgents();
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

  function clearFilters() { setSearch(''); setDateFrom(''); setDateTo(''); setPage(0); }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const agentTotalPages = Math.ceil(agents.length / AGENT_PAGE_SIZE);
  const paginatedAgents = agents.slice(agentPage * AGENT_PAGE_SIZE, (agentPage + 1) * AGENT_PAGE_SIZE);

  async function handleDeleteEnrollment(record: Enrollment): Promise<void> {
    if (!window.confirm(`Delete enrollment record for "${record.agentName}" on ${record.date}?`)) return;
    setDeleteError('');
    setDeletingId(record.id);
    try {
      await deleteDoc(doc(db, 'enrollments', record.id));
      setEnrollments(prev => prev.filter(r => r.id !== record.id));
    } catch (err: any) {
      setDeleteError('Failed to delete record: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  }

  function openEditEnrollment(record: Enrollment) {
    setEditEnrollment(record);
    setEditDate(record.date);
    setEditDailyFigures(String(record.dailyFigures));
    setEditIssues(record.issuesComplaints || '');
  }

  async function handleEditEnrollmentSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editEnrollment) return;
    setEditEnrollmentSaving(true);
    try {
      const updates = {
        date: editDate,
        dailyFigures: Number(editDailyFigures),
        issuesComplaints: editIssues,
      };
      await updateDoc(doc(db, 'enrollments', editEnrollment.id), updates);
      setEnrollments(prev => prev.map(r => r.id === editEnrollment.id ? { ...r, ...updates } : r));
      setEditEnrollment(null);
    } catch (err: any) {
      alert('Failed to update record: ' + err.message);
    } finally {
      setEditEnrollmentSaving(false);
    }
  }

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
        deviceId: newDeviceId, phone: newPhone, createdAt: new Date().toISOString(),
      });
      await secondaryAuth.signOut();
      setAddSuccess(`"${newName}" created as ${newRole}.`);
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewDeviceId(''); setNewPhone(''); setNewRole('AGENT');
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
    setEditPhone(a.phone || '');
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editAgent) return;
    setEditSaving(true);
    try {
      await updateDoc(doc(db, 'users', editAgent.id), { name: editName, deviceId: editDeviceId, phone: editPhone });
      setAgents(prev => prev.map(a => a.id === editAgent.id ? { ...a, name: editName, deviceId: editDeviceId, phone: editPhone } : a));
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

  // --- Enrollment Log functions ---
  async function loadEnrollmentLogs(agentId: string) {
    setLoadingLogsForAgent(agentId);
    try {
      const q = query(collection(db, 'enrollmentLogs'), where('agentId', '==', agentId));
      const snap = await getDocs(q);
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() } as EnrollmentLog));
      setEnrollmentLogsByAgent(prev => ({ ...prev, [agentId]: sortEnrollmentLogs(logs) }));
    } catch (err: any) {
      console.error('Failed to load enrollment logs:', err);
      setEnrollmentLogsByAgent(prev => ({ ...prev, [agentId]: [] }));
    } finally {
      setLoadingLogsForAgent(null);
    }
  }

  function toggleAgentExpand(agentId: string) {
    if (expandedAgentId === agentId) {
      setExpandedAgentId(null);
    } else {
      setExpandedAgentId(agentId);
      if (!enrollmentLogsByAgent[agentId]) {
        loadEnrollmentLogs(agentId);
      }
    }
  }

  function openAddLog(agent: Agent) {
    setAddLogAgent(agent);
    setAddLogMonth('1');
    setAddLogYear(String(new Date().getFullYear()));
    setAddLogTotal('');
    setAddLogError('');
    setAddLogSuccess('');
  }

  async function handleAddLogSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!addLogAgent) return;
    setAddLogSaving(true);
    setAddLogError('');
    try {
      const payload = buildEnrollmentLogDocument({
        agentId: addLogAgent.id,
        agentName: addLogAgent.name,
        month: Number(addLogMonth),
        year: Number(addLogYear),
        totalEnrollment: Number(addLogTotal),
        adminUid: _user.uid,
      });
      const ref = await addDoc(collection(db, 'enrollmentLogs'), payload);
      const newEntry: EnrollmentLog = { id: ref.id, ...payload };
      setEnrollmentLogsByAgent(prev => ({
        ...prev,
        [addLogAgent.id]: sortEnrollmentLogs([...(prev[addLogAgent.id] ?? []), newEntry]),
      }));
      setAddLogSuccess('Enrollment log added successfully.');
      setTimeout(() => { setAddLogAgent(null); setAddLogSuccess(''); }, 1200);
    } catch (err: any) {
      setAddLogError('Failed to save: ' + err.message);
    } finally {
      setAddLogSaving(false);
    }
  }

  function openEditLog(log: EnrollmentLog) {
    setEditLog(log);
    setEditLogMonth(String(log.month));
    setEditLogYear(String(log.year));
    setEditLogTotal(String(log.totalEnrollment));
    setEditLogError('');
  }

  async function handleEditLogSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editLog) return;
    setEditLogSaving(true);
    setEditLogError('');
    try {
      const patch = buildEnrollmentLogPatch({
        month: Number(editLogMonth),
        year: Number(editLogYear),
        totalEnrollment: Number(editLogTotal),
      });
      await updateDoc(doc(db, 'enrollmentLogs', editLog.id), patch as unknown as Record<string, unknown>);
      const updated: EnrollmentLog = { ...editLog, ...patch };
      setEnrollmentLogsByAgent(prev => ({
        ...prev,
        [editLog.agentId]: sortEnrollmentLogs(
          (prev[editLog.agentId] ?? []).map(l => l.id === editLog.id ? updated : l)
        ),
      }));
      setEditLog(null);
    } catch (err: any) {
      setEditLogError('Failed to update: ' + err.message);
    } finally {
      setEditLogSaving(false);
    }
  }

  async function handleDeleteLog(log: EnrollmentLog) {
    if (!window.confirm(`Delete the ${formatMonthName(log.month)} ${log.year} log entry for "${log.agentName}"?`)) return;
    try {
      await deleteDoc(doc(db, 'enrollmentLogs', log.id));
      setEnrollmentLogsByAgent(prev => ({
        ...prev,
        [log.agentId]: (prev[log.agentId] ?? []).filter(l => l.id !== log.id),
      }));
    } catch (err: any) {
      alert('Failed to delete log entry: ' + err.message);
    }
  }

  const filteredAccountAgents = filterAgentsByDeviceId(accountAgents, accountDeviceIdSearch);

  function openEditAccount(agent: Agent) {
    setEditAccountAgent(agent);
    setEditAccountNumber(agent.accountNumber || '');
    setEditAccountName(agent.accountName || '');
    setEditBankName(agent.bankName || '');
    setEditAccountError('');
  }

  async function handleDeleteAccountDetails(agent: Agent) {
    if (!window.confirm(`Delete account details for "${agent.name}"? The agent will be able to submit new account details.`)) return;
    try {
      await updateDoc(doc(db, 'users', agent.id), {
        accountNumber: '',
        accountName: '',
        bankName: '',
        accountLocked: false,
      });
      setAccountAgents(prev => prev.map(a =>
        a.id === agent.id
          ? { ...a, accountNumber: '', accountName: '', bankName: '', accountLocked: false }
          : a
      ));
    } catch (err: any) {
      alert('Failed to delete account details: ' + err.message);
    }
  }

  async function handleEditAccountSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editAccountAgent) return;
    if (!editAccountNumber.trim() || !editAccountName.trim() || !editBankName.trim()) {
      setEditAccountError('All three fields are required.');
      return;
    }
    setEditAccountSaving(true);
    setEditAccountError('');
    try {
      await updateDoc(doc(db, 'users', editAccountAgent.id), {
        accountNumber: editAccountNumber.trim(),
        accountName: editAccountName.trim(),
        bankName: editBankName.trim(),
        accountLocked: true,
      });
      setAccountAgents(prev => prev.map(a =>
        a.id === editAccountAgent.id
          ? { ...a, accountNumber: editAccountNumber.trim(), accountName: editAccountName.trim(), bankName: editBankName.trim(), accountLocked: true }
          : a
      ));
      setEditAccountAgent(null);
    } catch (err: any) {
      setEditAccountError('Failed to save: ' + err.message);
    } finally {
      setEditAccountSaving(false);
    }
  }

  function exportAccountDetailsExcel() {
    const today = new Date().toISOString().split('T')[0];
    const fileName = `account-details-${today}.xlsx`;
    const wb = XLSX.utils.book_new();
    const wsData: string[][] = [
      ['Agent Name', 'Device ID', 'Account Number', 'Account Name', 'Bank Name'],
      ...filteredAccountAgents.map(a => [
        a.name,
        a.deviceId || '',
        a.accountNumber || '',
        a.accountName || '',
        a.bankName || '',
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 30 }, { wch: 22 }, { wch: 15 }, { wch: 30 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Account Details');
    XLSX.writeFile(wb, fileName);
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
      {/* Add Enrollment Log Modal */}
      {addLogAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-1">Add Enrollment Log</h3>
            <p className="text-sm text-gray-500 mb-4">Agent: <span className="font-medium text-gray-700">{addLogAgent.name}</span></p>
            <form onSubmit={handleAddLogSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                  <select required value={addLogMonth} onChange={e => setAddLogMonth(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{formatMonthName(i + 1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <input type="number" required min="2000" max="2100" value={addLogYear}
                    onChange={e => setAddLogYear(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Enrollment</label>
                <input type="number" required min="0" value={addLogTotal}
                  onChange={e => setAddLogTotal(e.target.value)}
                  placeholder="Enter total enrollment for the month"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              {addLogError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{addLogError}</div>}
              {addLogSuccess && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2">{addLogSuccess}</div>}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={addLogSaving}
                  className="flex-1 bg-teal-700 hover:bg-teal-800 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 text-sm">
                  {addLogSaving ? 'Saving...' : 'Submit'}
                </button>
                <button type="button" onClick={() => setAddLogAgent(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-lg transition-colors text-sm">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Enrollment Log Modal */}
      {editLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-1">Edit Enrollment Log</h3>
            <p className="text-sm text-gray-500 mb-4">Agent: <span className="font-medium text-gray-700">{editLog.agentName}</span></p>
            <form onSubmit={handleEditLogSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                  <select required value={editLogMonth} onChange={e => setEditLogMonth(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{formatMonthName(i + 1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <input type="number" required min="2000" max="2100" value={editLogYear}
                    onChange={e => setEditLogYear(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Enrollment</label>
                <input type="number" required min="0" value={editLogTotal}
                  onChange={e => setEditLogTotal(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              {editLogError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{editLogError}</div>}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={editLogSaving}
                  className="flex-1 bg-teal-700 hover:bg-teal-800 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 text-sm">
                  {editLogSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setEditLog(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-lg transition-colors text-sm">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Agent Modal */}
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
                <input type="text" value={editDeviceId} onChange={e => setEditDeviceId(e.target.value.slice(0, 20))}
                  placeholder="HENA-315835789326461" maxLength={20}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono" />
                <p className="text-xs text-gray-400 mt-1">{editDeviceId.length}/20 characters</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input type="tel" value={editPhone}
                  onChange={e => setEditPhone(e.target.value.replace(/[^0-9+\-\s()]/g, '').slice(0, 15))}
                  placeholder="+234 800 000 0000"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
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
      {/* Edit Enrollment Modal */}
      {editEnrollment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Edit Enrollment Record</h3>
            <p className="text-sm text-gray-500 mb-4">Agent: <span className="font-medium text-gray-700">{editEnrollment.agentName}</span></p>
            <form onSubmit={handleEditEnrollmentSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" required value={editDate} onChange={e => setEditDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Daily Enrollment Figures</label>
                <input type="number" required min="0" value={editDailyFigures} onChange={e => setEditDailyFigures(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Issues / Complaints</label>
                <textarea value={editIssues} onChange={e => setEditIssues(e.target.value)} rows={3}
                  placeholder="None"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={editEnrollmentSaving}
                  className="flex-1 bg-teal-700 hover:bg-teal-800 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 text-sm">
                  {editEnrollmentSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setEditEnrollment(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-lg transition-colors text-sm">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Account Details Modal */}
      {editAccountAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-1">Edit Account Details</h3>
            <p className="text-sm text-gray-500 mb-4">Agent: <span className="font-medium text-gray-700">{editAccountAgent.name}</span></p>
            <form onSubmit={handleEditAccountSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={editAccountNumber}
                  onChange={e => setEditAccountNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                  placeholder="10-digit account number"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                <input
                  type="text"
                  maxLength={100}
                  value={editAccountName}
                  onChange={e => setEditAccountName(e.target.value)}
                  placeholder="Name on bank account"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                <input
                  type="text"
                  maxLength={100}
                  value={editBankName}
                  onChange={e => setEditBankName(e.target.value)}
                  placeholder="e.g. First Bank, GTBank"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              {editAccountError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{editAccountError}</div>}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={editAccountSaving}
                  className="flex-1 bg-teal-700 hover:bg-teal-800 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 text-sm">
                  {editAccountSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setEditAccountAgent(null)}
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
        <div className="flex flex-wrap gap-2 mb-5">
          {(['enrollments', 'agents', 'enrollmentLog', 'accountDetails'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm ${tab === t ? 'bg-teal-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}>
              {t === 'enrollments' ? '📋 Enrollment Records' : t === 'agents' ? '👥 Agents' : t === 'enrollmentLog' ? '📊 Enrollment Log' : '🏦 Account Details'}
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
                    onChange={e => { setSearch(e.target.value); setPage(0); }}
                    className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-50" />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-gray-500">From</span>
                  <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-50" />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-gray-500">To</span>
                  <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }}
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

            {deleteError && (
              <div className="mx-5 mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                {deleteError}
              </div>
            )}

            {loading ? (              <div className="flex items-center justify-center py-16 text-gray-400">
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
                      {['Date', 'Agent', 'Location', 'Device ID', 'Enrollees', 'Issues', 'Actions'].map((h, i) => (
                        <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${i === 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paginated.map((r, i) => (
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
                        <td className="px-4 py-3.5">
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => openEditEnrollment(r)}
                              className="text-xs text-teal-600 hover:text-teal-800 border border-teal-200 hover:border-teal-400 bg-teal-50 hover:bg-teal-100 px-2.5 py-1.5 rounded-lg transition-colors font-medium"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteEnrollment(r)}
                              disabled={deletingId === r.id}
                              className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                            {deletingId === r.id ? (
                              <>
                                <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                </svg>
                                Deleting…
                              </>
                            ) : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-gray-100">
                <span className="text-sm text-gray-500">
                  {filtered.length} records · Page {page + 1} of {totalPages}
                </span>
                <div className="flex flex-wrap items-center gap-1">
                  <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    ←
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => {
                    const showPage = i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 2;
                    const showEllipsisBefore = i === page - 3 && i > 1;
                    const showEllipsisAfter = i === page + 3 && i < totalPages - 2;
                    if (showEllipsisBefore || showEllipsisAfter) {
                      return <span key={i} className="px-1 text-gray-400 text-sm">…</span>;
                    }
                    if (!showPage) return null;
                    return (
                      <button key={i} onClick={() => setPage(i)}
                        className={`min-w-[32px] px-2.5 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                          page === i
                            ? 'bg-teal-700 text-white border-teal-700'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}>
                        {i + 1}
                      </button>
                    );
                  })}
                  <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    →
                  </button>
                </div>
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
                    <input type="text" value={newDeviceId} onChange={e => setNewDeviceId(e.target.value.slice(0, 20))}
                      placeholder="HENA-315835789326461" maxLength={20}
                      className={inputCls + ' font-mono'} />
                    <p className="text-xs text-gray-400 mt-1">{newDeviceId.length}/20 characters</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number <span className="text-gray-400">(optional)</span></label>
                    <input type="tel" value={newPhone}
                      onChange={e => setNewPhone(e.target.value.replace(/[^0-9+\-\s()]/g, '').slice(0, 15))}
                      placeholder="+234 800 000 0000" className={inputCls} />
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
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Device ID</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Registered</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {paginatedAgents.map((a, i) => (
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
                          <td className="px-4 py-3.5 text-gray-500 text-xs">{a.phone || <span className="text-gray-300">—</span>}</td>
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
              {agentTotalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-gray-100">
                  <span className="text-sm text-gray-500">
                    {agents.length} agents · Page {agentPage + 1} of {agentTotalPages}
                  </span>
                  <div className="flex flex-wrap items-center gap-1">
                    <button onClick={() => setAgentPage(p => p - 1)} disabled={agentPage === 0}
                      className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      ←
                    </button>
                    {Array.from({ length: agentTotalPages }, (_, i) => {
                      const showPage = i === 0 || i === agentTotalPages - 1 || Math.abs(i - agentPage) <= 2;
                      const showEllipsisBefore = i === agentPage - 3 && i > 1;
                      const showEllipsisAfter = i === agentPage + 3 && i < agentTotalPages - 2;
                      if (showEllipsisBefore || showEllipsisAfter) {
                        return <span key={i} className="px-1 text-gray-400 text-sm">…</span>;
                      }
                      if (!showPage) return null;
                      return (
                        <button key={i} onClick={() => setAgentPage(i)}
                          className={`min-w-[32px] px-2.5 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                            agentPage === i
                              ? 'bg-teal-700 text-white border-teal-700'
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                          }`}>
                          {i + 1}
                        </button>
                      );
                    })}
                    <button onClick={() => setAgentPage(p => p + 1)} disabled={agentPage >= agentTotalPages - 1}
                      className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'enrollmentLog' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Enrollment Log</h2>
              <p className="text-sm text-gray-500 mt-0.5">Manage monthly enrollment totals per agent</p>
              <div className="relative mt-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input type="text" placeholder="Search by Device ID..." value={deviceIdSearch}
                  onChange={e => { setDeviceIdSearch(e.target.value); setEnrollmentLogPage(0); }}
                  className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-50" />
              </div>
            </div>

            {(() => {
              const filteredAgents = filterAgentsByDeviceId(agents, deviceIdSearch);
              const elTotalPages = Math.ceil(filteredAgents.length / ENROLLMENT_LOG_PAGE_SIZE);
              const paginatedElAgents = filteredAgents.slice(enrollmentLogPage * ENROLLMENT_LOG_PAGE_SIZE, (enrollmentLogPage + 1) * ENROLLMENT_LOG_PAGE_SIZE);
              if (filteredAgents.length === 0) {
                return (
                  <div className="text-center py-16 text-gray-400">
                    <p className="font-medium">{deviceIdSearch ? 'No agents found' : 'No agents registered yet.'}</p>
                  </div>
                );
              }
              return (
                <>
                <div className="divide-y divide-gray-100">
                  {paginatedElAgents.map(agent => {
                    const isExpanded = expandedAgentId === agent.id;
                    const logs = enrollmentLogsByAgent[agent.id] ?? [];
                    const isLoadingLogs = loadingLogsForAgent === agent.id;
                    return (
                      <div key={agent.id}>
                        <div className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                              {agent.name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-800 text-sm">{agent.name}</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {agent.deviceId
                                  ? <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{agent.deviceId}</span>
                                  : <span className="text-xs text-gray-400">No Device ID</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => openAddLog(agent)}
                              className="text-xs bg-teal-700 hover:bg-teal-800 text-white font-medium px-3 py-1.5 rounded-lg transition-colors">
                              + Add
                            </button>
                            <button onClick={() => toggleAgentExpand(agent.id)}
                              className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors font-medium">
                              {isExpanded ? '▲ Hide' : '▼ View'}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-5 pb-4 bg-gray-50/60 border-t border-gray-100">
                            {isLoadingLogs ? (
                              <div className="flex items-center gap-2 py-6 text-gray-400 text-sm">
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                </svg>
                                Loading logs...
                              </div>
                            ) : logs.length === 0 ? (
                              <p className="text-sm text-gray-400 py-6 text-center">No log entries yet.</p>
                            ) : (
                              <div className="overflow-x-auto mt-3">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-white border border-gray-100 rounded-lg">
                                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Month</th>
                                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Year</th>
                                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Enrollment</th>
                                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {logs.map(log => (
                                      <tr key={log.id} className="bg-white hover:bg-teal-50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-gray-700">{formatMonthName(log.month)}</td>
                                        <td className="px-4 py-3 text-gray-600">{log.year}</td>
                                        <td className="px-4 py-3 text-right">
                                          <span className="inline-flex items-center justify-center bg-teal-100 text-teal-800 font-bold text-sm px-3 py-1 rounded-full">
                                            {log.totalEnrollment.toLocaleString()}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="flex gap-1.5">
                                            <button onClick={() => openEditLog(log)}
                                              className="text-xs text-teal-600 hover:text-teal-800 border border-teal-200 hover:border-teal-400 bg-teal-50 hover:bg-teal-100 px-2.5 py-1.5 rounded-lg transition-colors font-medium">
                                              Edit
                                            </button>
                                            <button onClick={() => handleDeleteLog(log)}
                                              className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors font-medium">
                                              Delete
                                            </button>
                                          </div>
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
                    );
                  })}
                </div>
                {elTotalPages > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-gray-100">
                    <span className="text-sm text-gray-500">
                      {filteredAgents.length} agents · Page {enrollmentLogPage + 1} of {elTotalPages}
                    </span>
                    <div className="flex flex-wrap items-center gap-1">
                      <button onClick={() => setEnrollmentLogPage(p => p - 1)} disabled={enrollmentLogPage === 0}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                        ←
                      </button>
                      {Array.from({ length: elTotalPages }, (_, i) => {
                        const showPage = i === 0 || i === elTotalPages - 1 || Math.abs(i - enrollmentLogPage) <= 2;
                        const showEllipsisBefore = i === enrollmentLogPage - 3 && i > 1;
                        const showEllipsisAfter = i === enrollmentLogPage + 3 && i < elTotalPages - 2;
                        if (showEllipsisBefore || showEllipsisAfter) return <span key={i} className="px-1 text-gray-400 text-sm">…</span>;
                        if (!showPage) return null;
                        return (
                          <button key={i} onClick={() => setEnrollmentLogPage(i)}
                            className={`min-w-[32px] px-2.5 py-1.5 text-sm font-medium rounded-lg border transition-colors ${enrollmentLogPage === i ? 'bg-teal-700 text-white border-teal-700' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                            {i + 1}
                          </button>
                        );
                      })}
                      <button onClick={() => setEnrollmentLogPage(p => p + 1)} disabled={enrollmentLogPage >= elTotalPages - 1}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                        →
                      </button>
                    </div>
                  </div>
                )}
                </>
              );
            })()}
          </div>
        )}
        {tab === 'accountDetails' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
            <div className="p-5 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Account Details</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Bank account information submitted by agents</p>
                </div>
                <button onClick={exportAccountDetailsExcel}
                  className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export Excel
                </button>
              </div>
              <div className="relative">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input type="text" placeholder="Search by Device ID..." value={accountDeviceIdSearch}
                  onChange={e => { setAccountDeviceIdSearch(e.target.value); setAccountPage(0); }}
                  className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-50" />
              </div>
            </div>

            {accountAgentsError && (
              <div className="mx-5 mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                {accountAgentsError}
              </div>
            )}

            {loadingAccountAgents ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <svg className="animate-spin h-6 w-6 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Loading agents...
              </div>
            ) : filteredAccountAgents.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="font-medium">{accountDeviceIdSearch ? 'No agents found' : 'No agents registered yet.'}</p>
              </div>
            ) : (
              <>
              {(() => {
                const acTotalPages = Math.ceil(filteredAccountAgents.length / ACCOUNT_PAGE_SIZE);
                const paginatedAccountAgents = filteredAccountAgents.slice(accountPage * ACCOUNT_PAGE_SIZE, (accountPage + 1) * ACCOUNT_PAGE_SIZE);
                return (
                  <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Agent Name</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Device ID</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Account Number</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Account Name</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Bank Name</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {paginatedAccountAgents.map((a, i) => (
                          <tr key={a.id} className={`hover:bg-teal-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                                  {a.name?.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-semibold text-gray-800">{a.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{a.deviceId || '—'}</span>
                            </td>
                            {!a.accountNumber && !a.accountName && !a.bankName ? (
                              <td colSpan={3} className="px-4 py-3.5">
                                <span className="inline-flex items-center bg-amber-100 text-amber-700 text-xs font-medium px-2.5 py-1 rounded-full">
                                  Not submitted
                                </span>
                              </td>
                            ) : (
                              <>
                                <td className="px-4 py-3.5 font-mono text-sm text-gray-700">{a.accountNumber || <span className="text-gray-300">—</span>}</td>
                                <td className="px-4 py-3.5 text-gray-700">{a.accountName || <span className="text-gray-300">—</span>}</td>
                                <td className="px-4 py-3.5 text-gray-700">{a.bankName || <span className="text-gray-300">—</span>}</td>
                              </>
                            )}
                            <td className="px-4 py-3.5">
                              <div className="flex gap-1.5">
                                <button onClick={() => openEditAccount(a)}
                                  className="text-xs text-teal-600 hover:text-teal-800 border border-teal-200 hover:border-teal-400 bg-teal-50 hover:bg-teal-100 px-2.5 py-1.5 rounded-lg transition-colors font-medium">
                                  Edit
                                </button>
                                <button onClick={() => handleDeleteAccountDetails(a)}
                                  className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors font-medium">
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {acTotalPages > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-gray-100">
                      <span className="text-sm text-gray-500">
                        {filteredAccountAgents.length} agents · Page {accountPage + 1} of {acTotalPages}
                      </span>
                      <div className="flex flex-wrap items-center gap-1">
                        <button onClick={() => setAccountPage(p => p - 1)} disabled={accountPage === 0}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                          ←
                        </button>
                        {Array.from({ length: acTotalPages }, (_, i) => {
                          const showPage = i === 0 || i === acTotalPages - 1 || Math.abs(i - accountPage) <= 2;
                          const showEllipsisBefore = i === accountPage - 3 && i > 1;
                          const showEllipsisAfter = i === accountPage + 3 && i < acTotalPages - 2;
                          if (showEllipsisBefore || showEllipsisAfter) return <span key={i} className="px-1 text-gray-400 text-sm">…</span>;
                          if (!showPage) return null;
                          return (
                            <button key={i} onClick={() => setAccountPage(i)}
                              className={`min-w-[32px] px-2.5 py-1.5 text-sm font-medium rounded-lg border transition-colors ${accountPage === i ? 'bg-teal-700 text-white border-teal-700' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                              {i + 1}
                            </button>
                          );
                        })}
                        <button onClick={() => setAccountPage(p => p + 1)} disabled={accountPage >= acTotalPages - 1}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                          →
                        </button>
                      </div>
                    </div>
                  )}
                  </>
                );
              })()}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
