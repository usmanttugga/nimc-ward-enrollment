import { useState, useEffect } from 'react';
import { User, signOut, createUserWithEmailAndPassword, updateProfile, getAuth, sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, orderBy, getDocs, doc, setDoc, deleteDoc, updateDoc, addDoc, where, getDoc } from 'firebase/firestore';
import { loadGeoData, State } from '../geoData';
import { formatAggregatorId, AggregatorUser, findNextAvailableSequence } from '../aggregatorUtils';
import { initializeApp } from 'firebase/app';
import * as XLSX from 'xlsx';
import { auth, db } from '../firebase';
import Logo from '../components/Logo';
import ChangePasswordForm from '../components/ChangePasswordForm';
import SetPasswordModal from '../components/SetPasswordModal';
import {
  filterAgentsByDeviceId,
  buildEnrollmentLogDocument,
  buildEnrollmentLogPatch,
  formatMonthRange,
  sortEnrollmentLogs,
  EnrollmentLog,
} from '../enrollmentLogUtils';
import {
  PersonalizationRecord,
  buildPersonalizationPatch,
  validatePersonalizationDate,
  validatePersonalizationCount,
  sortPersonalizationRecords,
  computeGrandTotal,
  computeAgentPersonalizationSummaries,
  computeTotalsByAgentId,
} from '../personalizationUtils';

interface Props { user: User; }
interface Enrollment {
  id: string; date: string; stateName: string; lgaName: string; wardName: string;
  deviceId: string; dailyFigures: number; issuesComplaints: string;
  agentName: string; agentEmail: string; submittedAt: string;
}
interface Agent { id: string; name: string; email: string; deviceId?: string; deviceDroidNumber?: string; phone?: string; createdAt: string; accountNumber?: string; accountName?: string; bankName?: string; accountLocked?: boolean; aggregatorId?: string; }

export default function AdminPage({ user: _user }: Props) {
  const [tab, setTab] = useState<'enrollments' | 'agents' | 'enrollmentLog' | 'personalizationRecords' | 'accountDetails' | 'aggregators' | 'profile'>('enrollments');
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
  const [newRole, setNewRole] = useState<'AGENT' | 'ADMIN' | 'AGGREGATOR'>('AGENT');
  const [addingUser, setAddingUser] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [editAgent, setEditAgent] = useState<Agent | null>(null);
  // --- Geo data for AGENT/AGGREGATOR creation ---
  const [geoData, setGeoData] = useState<State[]>([]);
  const [newStateId, setNewStateId] = useState('');
  const [newStateName, setNewStateName] = useState('');
  const [newLgaId, setNewLgaId] = useState('');
  const [newLgaName, setNewLgaName] = useState('');
  // --- Aggregators tab state ---
  const [aggregators, setAggregators] = useState<AggregatorUser[]>([]);
  const [loadingAggregators, setLoadingAggregators] = useState(false);
  const [aggregatorSearch, setAggregatorSearch] = useState('');
  const [showAddAggregator, setShowAddAggregator] = useState(false);
  const [addAggName, setAddAggName] = useState('');
  const [addAggEmail, setAddAggEmail] = useState('');
  const [addAggPassword, setAddAggPassword] = useState('');
  const [addAggPhone, setAddAggPhone] = useState('');
  const [addAggStateId, setAddAggStateId] = useState('');
  const [addAggStateName, setAddAggStateName] = useState('');
  const [addAggLgaId, setAddAggLgaId] = useState('');
  const [addAggLgaName, setAddAggLgaName] = useState('');
  const [addAggOfficeAddress, setAddAggOfficeAddress] = useState('');
  const [addAggLoading, setAddAggLoading] = useState(false);
  const [addAggError, setAddAggError] = useState('');
  const [addAggSuccess, setAddAggSuccess] = useState('');
  // Invite code management
  const [inviteCode, setInviteCode] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [savingInviteCode, setSavingInviteCode] = useState(false);
  const [inviteCodeMsg, setInviteCodeMsg] = useState('');
  // Edit aggregator modal
  const [editAggregator, setEditAggregator] = useState<AggregatorUser | null>(null);
  const [editAggName, setEditAggName] = useState('');
  const [editAggPhone, setEditAggPhone] = useState('');
  const [editAggSaving, setEditAggSaving] = useState(false);
  const [editAggError, setEditAggError] = useState('');
  const [aggResetMsg, setAggResetMsg] = useState<Record<string, string>>({});
  // --- Assign aggregator state ---
  const [allAggregators, setAllAggregators] = useState<AggregatorUser[]>([]);
  const [assigningAggregatorId, setAssigningAggregatorId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDeviceId, setEditDeviceId] = useState('');
  const [editDroidNumber, setEditDroidNumber] = useState('DROID-S120-');
  const [editPhone, setEditPhone] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [resetMsg, setResetMsg] = useState<Record<string, string>>({});
  const [setPasswordTarget, setSetPasswordTarget] = useState<{ uid: string; name: string; role: 'AGENT' | 'AGGREGATOR' } | null>(null);
  const [setPasswordSuccessMsg, setSetPasswordSuccessMsg] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const [agentPage, setAgentPage] = useState(0);
  const AGENT_PAGE_SIZE = 20;
  const [agentSearch, setAgentSearch] = useState('');
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
  const [addLogStartMonth, setAddLogStartMonth] = useState('1');
  const [addLogEndMonth, setAddLogEndMonth] = useState('1');
  const [addLogYear, setAddLogYear] = useState(String(new Date().getFullYear()));
  const [addLogTotal, setAddLogTotal] = useState('');
  const [addLogSaving, setAddLogSaving] = useState(false);
  const [addLogError, setAddLogError] = useState('');
  const [addLogSuccess, setAddLogSuccess] = useState('');
  // Edit Log Form
  const [editLog, setEditLog] = useState<EnrollmentLog | null>(null);
  const [editLogStartMonth, setEditLogStartMonth] = useState('1');
  const [editLogEndMonth, setEditLogEndMonth] = useState('1');
  const [editLogYear, setEditLogYear] = useState('');
  const [editLogTotal, setEditLogTotal] = useState('');
  const [editLogSaving, setEditLogSaving] = useState(false);
  const [editLogError, setEditLogError] = useState('');

  // --- Personalization Records admin state ---
  const [adminPersRecords, setAdminPersRecords] = useState<PersonalizationRecord[]>([]);
  const [loadingAdminPers, setLoadingAdminPers] = useState(false);
  const [adminPersError, setAdminPersError] = useState('');
  const [persViewMode, setPersViewMode] = useState<'allRecords' | 'agentSummary'>('allRecords');
  const [persAgentSearch, setPersAgentSearch] = useState('');
  const [editPersRecord, setEditPersRecord] = useState<PersonalizationRecord | null>(null);
  const [editPersDate, setEditPersDate] = useState('');
  const [editPersCount, setEditPersCount] = useState('');
  const [editPersSaving, setEditPersSaving] = useState(false);
  const [editPersError, setEditPersError] = useState('');
  const [deletingPersId, setDeletingPersId] = useState<string | null>(null);

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

  async function loadAggregators() {
    setLoadingAggregators(true);
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'AGGREGATOR'));
      const snap = await getDocs(q);
      setAggregators(snap.docs.map(d => ({ id: d.id, ...d.data() } as AggregatorUser)));
    } finally {
      setLoadingAggregators(false);
    }
    // Also load the current invite code
    const codeSnap = await getDoc(doc(db, 'settings', 'aggregatorInviteCode'));
    const code = codeSnap.exists() ? (codeSnap.data().code ?? '') : '';
    setInviteCode(code);
    setInviteCodeInput(code);
  }

  async function handleSaveInviteCode(e: React.FormEvent) {
    e.preventDefault();
    setSavingInviteCode(true);
    setInviteCodeMsg('');
    try {
      await setDoc(doc(db, 'settings', 'aggregatorInviteCode'), { code: inviteCodeInput.trim() });
      setInviteCode(inviteCodeInput.trim());
      setInviteCodeMsg('Invite code saved successfully.');
      setTimeout(() => setInviteCodeMsg(''), 3000);
    } catch (err: any) {
      setInviteCodeMsg('Failed to save: ' + err.message);
    } finally {
      setSavingInviteCode(false);
    }
  }

  async function loadAllAggregators() {
    const q = query(collection(db, 'users'), where('role', '==', 'AGGREGATOR'));
    const snap = await getDocs(q);
    setAllAggregators(snap.docs.map(d => ({ id: d.id, ...d.data() } as AggregatorUser)));
  }

  function openEditAggregator(agg: AggregatorUser) {
    setEditAggregator(agg);
    setEditAggName(agg.name);
    setEditAggPhone(agg.phone || '');
    setEditAggError('');
  }

  async function handleEditAggregatorSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editAggregator) return;
    if (!editAggName.trim()) { setEditAggError('Name is required.'); return; }
    setEditAggSaving(true);
    setEditAggError('');
    try {
      await updateDoc(doc(db, 'users', editAggregator.id), { name: editAggName.trim(), phone: editAggPhone });
      setAggregators(prev => prev.map(a => a.id === editAggregator.id ? { ...a, name: editAggName.trim(), phone: editAggPhone } : a));
      setAllAggregators(prev => prev.map(a => a.id === editAggregator.id ? { ...a, name: editAggName.trim(), phone: editAggPhone } : a));
      setEditAggregator(null);
    } catch (err: any) {
      setEditAggError('Failed to update: ' + err.message);
    } finally {
      setEditAggSaving(false);
    }
  }

  async function handleDeleteAggregator(aggId: string, aggName: string) {
    if (!window.confirm(`Delete aggregator "${aggName}"? This removes their profile. Their linked agents will become unlinked.`)) return;
    try {
      await deleteDoc(doc(db, 'users', aggId));
      setAggregators(prev => prev.filter(a => a.id !== aggId));
      setAllAggregators(prev => prev.filter(a => a.id !== aggId));
    } catch (err: any) {
      alert('Failed to delete aggregator: ' + err.message);
    }
  }

  async function handleAddAggregator(e: React.FormEvent) {
    e.preventDefault();
    setAddAggError(''); setAddAggSuccess('');
    setAddAggLoading(true);
    try {
      const secondaryApp = initializeApp(auth.app.options, 'secondary-agg-' + Date.now());
      const secondaryAuth = getAuth(secondaryApp);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, addAggEmail, addAggPassword);
      await updateProfile(cred.user, { displayName: addAggName });

      // Generate aggregator ID using gap-filling
      const existingSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'AGGREGATOR')));
      const existingIds = existingSnap.docs.map(d => d.data().aggregatorId as string).filter(Boolean);
      const aggId = formatAggregatorId(findNextAvailableSequence(existingIds));

      await setDoc(doc(db, 'users', cred.user.uid), {
        name: addAggName, email: addAggEmail, role: 'AGGREGATOR',
        aggregatorId: aggId, phone: addAggPhone,
        profileStateId: addAggStateId, profileStateName: addAggStateName,
        profileLgaId: addAggLgaId, profileLgaName: addAggLgaName,
        officeAddress: addAggOfficeAddress,
        createdAt: new Date().toISOString(),
      });
      await secondaryAuth.signOut();
      setAddAggSuccess(`"${addAggName}" created as AGGREGATOR. ID: ${aggId}`);
      setAddAggName(''); setAddAggEmail(''); setAddAggPassword(''); setAddAggPhone('');
      setAddAggStateId(''); setAddAggStateName(''); setAddAggLgaId(''); setAddAggLgaName('');
      setAddAggOfficeAddress('');
      loadAggregators();
      loadAllAggregators();
    } catch (err: any) {
      const msg: Record<string, string> = {
        'auth/email-already-in-use': 'Email already registered.',
        'auth/weak-password': 'Password must be at least 6 characters.',
        'auth/invalid-email': 'Invalid email address.',
      };
      setAddAggError(msg[err.code] || err.message);
    } finally {
      setAddAggLoading(false);
    }
  }

  async function handleAggregatorPasswordReset(aggId: string, email: string) {
    try {
      await sendPasswordResetEmail(auth, email);
      setAggResetMsg(prev => ({ ...prev, [aggId]: `Reset email sent to ${email}` }));
      setTimeout(() => setAggResetMsg(prev => { const n = { ...prev }; delete n[aggId]; return n; }), 5000);
    } catch (err: any) {
      alert('Failed to send reset email: ' + err.message);
    }
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

  useEffect(() => { loadGeoData().then(setGeoData); }, []);

  useEffect(() => {
    setLoading(true);
    if (tab === 'enrollments') {
      const q = query(collection(db, 'enrollments'), orderBy('submittedAt', 'desc'));
      getDocs(q).then(snap => {
        setEnrollments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Enrollment)));
      }).finally(() => setLoading(false));
    } else {
      if (tab === 'accountDetails' && accountAgents.length === 0) loadAccountAgents();
      if (tab === 'aggregators') loadAggregators();
      if (tab === 'agents') { loadAgents(); loadAllAggregators(); loadAdminPersonalizationRecords(); }
      else if (agents.length === 0) loadAgents();
      if (tab === 'personalizationRecords') loadAdminPersonalizationRecords();
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
  const filteredAgents = agents.filter(a => {
    if (!agentSearch.trim()) return true;
    const q = agentSearch.toLowerCase();
    return a.name?.toLowerCase().includes(q) ||
      a.email?.toLowerCase().includes(q) ||
      (a.deviceId ?? '').toLowerCase().includes(q) ||
      (a.phone ?? '').toLowerCase().includes(q);
  });
  const agentTotalPages = Math.ceil(filteredAgents.length / AGENT_PAGE_SIZE);
  const paginatedAgents = filteredAgents.slice(agentPage * AGENT_PAGE_SIZE, (agentPage + 1) * AGENT_PAGE_SIZE);

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

      if (newRole === 'AGGREGATOR') {
        // Generate aggregator ID using gap-filling
        const existingSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'AGGREGATOR')));
        const existingIds = existingSnap.docs.map(d => d.data().aggregatorId as string).filter(Boolean);
        const aggId = formatAggregatorId(findNextAvailableSequence(existingIds));

        await setDoc(doc(db, 'users', cred.user.uid), {
          name: newName, email: newEmail, role: 'AGGREGATOR',
          aggregatorId: aggId, phone: newPhone, createdAt: new Date().toISOString(),
        });
        await secondaryAuth.signOut();
        setAddSuccess(`"${newName}" created as AGGREGATOR. ID: ${aggId}`);
        loadAggregators();
        loadAllAggregators();
      } else if (newRole === 'AGENT') {
        await setDoc(doc(db, 'users', cred.user.uid), {
          name: newName, email: newEmail, role: newRole,
          deviceId: newDeviceId, phone: newPhone, createdAt: new Date().toISOString(),
          profileStateId: newStateId, profileStateName: newStateName,
          profileLgaId: newLgaId, profileLgaName: newLgaName,
        });
        await secondaryAuth.signOut();
        setAddSuccess(`"${newName}" created as ${newRole}.`);
      } else {
        await setDoc(doc(db, 'users', cred.user.uid), {
          name: newName, email: newEmail, role: newRole,
          deviceId: newDeviceId, phone: newPhone, createdAt: new Date().toISOString(),
        });
        await secondaryAuth.signOut();
        setAddSuccess(`"${newName}" created as ${newRole}.`);
      }

      setNewName(''); setNewEmail(''); setNewPassword(''); setNewDeviceId(''); setNewPhone(''); setNewRole('AGENT');
      setNewStateId(''); setNewStateName(''); setNewLgaId(''); setNewLgaName('');
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

  async function handleAssignAggregator(agentId: string, agentName: string, aggregatorUid: string, _aggregatorDisplayId: string) {
    const agent = agents.find(a => a.id === agentId);
    if (agent?.aggregatorId) {
      if (!window.confirm(`"${agentName}" is already assigned to an aggregator. Overwrite the assignment?`)) return;
    }
    setAssigningAggregatorId(agentId);
    try {
      await updateDoc(doc(db, 'users', agentId), { aggregatorId: aggregatorUid });
      setAgents(prev => prev.map(a => a.id === agentId ? { ...a, aggregatorId: aggregatorUid } : a));
    } catch (err: any) {
      alert(`Failed to assign aggregator: ${err.message}`);
    } finally {
      setAssigningAggregatorId(null);
    }
  }

  function openEdit(a: Agent) {
    setEditAgent(a);
    setEditName(a.name);
    setEditDeviceId(a.deviceId || '');
    setEditDroidNumber(a.deviceDroidNumber || 'DROID-S120-');
    setEditPhone(a.phone || '');
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editAgent) return;
    setEditSaving(true);
    try {
      await updateDoc(doc(db, 'users', editAgent.id), { name: editName, deviceId: editDeviceId, deviceDroidNumber: editDroidNumber, phone: editPhone });
      setAgents(prev => prev.map(a => a.id === editAgent.id ? { ...a, name: editName, deviceId: editDeviceId, deviceDroidNumber: editDroidNumber, phone: editPhone } : a));
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

  // --- Personalization Records admin functions ---
  async function loadAdminPersonalizationRecords() {
    setLoadingAdminPers(true);
    setAdminPersError('');
    try {
      const snap = await getDocs(collection(db, 'personalizationRecords'));
      const records = snap.docs.map(d => ({ id: d.id, ...d.data() } as PersonalizationRecord));
      setAdminPersRecords(sortPersonalizationRecords(records));
    } catch (_err: any) {
      setAdminPersError('Failed to load records.');
    } finally {
      setLoadingAdminPers(false);
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
    setAddLogStartMonth('1'); setAddLogEndMonth('1');
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
      if (Number(addLogStartMonth) > Number(addLogEndMonth)) {
        setAddLogError('End Month must be greater than or equal to Start Month.');
        setAddLogSaving(false);
        return;
      }
      const payload = buildEnrollmentLogDocument({
        agentId: addLogAgent.id,
        agentName: addLogAgent.name,
        startMonth: Number(addLogStartMonth),
        endMonth: Number(addLogEndMonth),
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
    const legacyMonth = (log as any).month as number | undefined;
    const initialStart = log.startMonth ?? legacyMonth ?? 1;
    const initialEnd   = log.endMonth   ?? legacyMonth ?? 1;
    setEditLogStartMonth(String(initialStart));
    setEditLogEndMonth(String(initialEnd));
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
      if (Number(editLogStartMonth) > Number(editLogEndMonth)) {
        setEditLogError('End Month must be greater than or equal to Start Month.');
        setEditLogSaving(false);
        return;
      }
      const patch = buildEnrollmentLogPatch({
        startMonth: Number(editLogStartMonth),
        endMonth: Number(editLogEndMonth),
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
    if (!window.confirm(`Delete the ${formatMonthRange(log.startMonth, log.endMonth, log.year)} log entry for "${log.agentName}"?`)) return;
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

  // --- Personalization Records edit/delete functions ---
  function openEditPersRecord(record: PersonalizationRecord) {
    setEditPersRecord(record);
    setEditPersDate(record.personalizationDate);
    setEditPersCount(String(record.count));
    setEditPersError('');
  }

  async function handleEditPersSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editPersRecord) return;

    if (!validatePersonalizationDate(editPersDate)) {
      setEditPersError('Please enter a valid date.');
      return;
    }
    const parsedCount = parseInt(editPersCount, 10);
    if (!validatePersonalizationCount(parsedCount, 999999)) {
      setEditPersError('Please enter a valid number (0–999999).');
      return;
    }

    setEditPersSaving(true);
    setEditPersError('');
    try {
      const patch = buildPersonalizationPatch({ personalizationDate: editPersDate, count: parsedCount });
      await updateDoc(doc(db, 'personalizationRecords', editPersRecord.id), patch as unknown as Record<string, unknown>);
      setAdminPersRecords(prev =>
        sortPersonalizationRecords(
          prev.map(r => r.id === editPersRecord!.id ? { ...r, personalizationDate: editPersDate, count: parsedCount } : r)
        )
      );
      setEditPersRecord(null);
    } catch {
      setEditPersError('Failed to update record. Please try again.');
    } finally {
      setEditPersSaving(false);
    }
  }

  async function handleDeletePersRecord(record: PersonalizationRecord) {
    if (!window.confirm(`Delete personalization record for ${record.personalizationDate} (count: ${record.count})? This cannot be undone.`)) return;
    setDeletingPersId(record.id);
    try {
      await deleteDoc(doc(db, 'personalizationRecords', record.id));
      setAdminPersRecords(prev => prev.filter(r => r.id !== record.id));
    } catch {
      alert('Failed to delete record. Please try again.');
    } finally {
      setDeletingPersId(null);
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

  const agentTotalsMap = computeTotalsByAgentId(adminPersRecords);

  function exportAgentsExcel() {
    const today = new Date().toISOString().split('T')[0];
    const fileName = `agents-${today}.xlsx`;
    const wb = XLSX.utils.book_new();
    const wsData: string[][] = [
      ['S/No.', 'Agent Name', 'Email', 'Phone', 'Device ID', 'State', 'LGA', 'Aggregator ID', 'Aggregator Name', 'Total Personalization', 'Registered'],
      ...filteredAgents.map((a, i) => {
        const agg = allAggregators.find(ag => ag.id === a.aggregatorId);
        return [
          String(i + 1),
          a.name || '',
          a.email || '',
          a.phone || '',
          a.deviceId || '',
          (a as any).profileStateName || '',
          (a as any).profileLgaName || '',
          agg ? agg.aggregatorId : '',
          agg ? agg.name : '',
          String(agentTotalsMap[a.id] || 0),
          a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-NG', { dateStyle: 'medium' }) : '',
        ];
      }),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 6 }, { wch: 30 }, { wch: 30 }, { wch: 14 }, { wch: 22 },
      { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Agents');
    XLSX.writeFile(wb, fileName);
  }

  function exportAgentPersonalizationExcel() {
    const today = new Date().toISOString().split('T')[0];
    const fileName = `agent-personalization-summary-${today}.xlsx`;
    const wb = XLSX.utils.book_new();
    const summaries = computeAgentPersonalizationSummaries(adminPersRecords);
    const filteredSummaries = summaries.filter(s =>
      !persAgentSearch || s.agentName.toLowerCase().includes(persAgentSearch.toLowerCase())
    );
    const wsData: string[][] = [
      ['S/No.', 'Agent Name', 'Total Personalization', 'Entries Count', 'Date Range'],
      ...filteredSummaries.map((s, i) => [
        String(i + 1),
        s.agentName || '',
        String(s.totalCount || 0),
        String(s.recordCount || 0),
        s.dateRange || '',
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 6 }, { wch: 30 }, { wch: 22 }, { wch: 15 }, { wch: 26 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Personalization Summary');
    XLSX.writeFile(wb, fileName);
  }

  function exportAllPersonalizationRecordsExcel() {
    const today = new Date().toISOString().split('T')[0];
    const fileName = `all-bulk-personalization-records-${today}.xlsx`;
    const wb = XLSX.utils.book_new();
    const wsData: string[][] = [
      ['S/No.', 'Agent Name', 'Date', 'Count', 'Submitted At'],
      ...adminPersRecords.map((r, i) => [
        String(i + 1),
        r.agentName || '',
        r.personalizationDate || '',
        String(r.count || 0),
        r.submittedAt ? new Date(r.submittedAt).toLocaleString('en-NG') : '',
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 6 }, { wch: 30 }, { wch: 18 }, { wch: 15 }, { wch: 25 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'All Submission Records');
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
      {/* Set Password success toast */}
      {setPasswordSuccessMsg && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {setPasswordSuccessMsg}
        </div>
      )}
      {/* Set Password Modal */}
      {setPasswordTarget && (
        <SetPasswordModal
          target={setPasswordTarget}
          adminUser={_user}
          onClose={() => setSetPasswordTarget(null)}
          onSuccess={(name) => {
            setSetPasswordSuccessMsg(`Password updated successfully for ${name}.`);
            setSetPasswordTarget(null);
            setTimeout(() => setSetPasswordSuccessMsg(''), 5000);
          }}
        />
      )}
      {/* Add Enrollment Log Modal */}
      {addLogAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-1">Add Enrollment Log</h3>
            <p className="text-sm text-gray-500 mb-4">Agent: <span className="font-medium text-gray-700">{addLogAgent.name}</span></p>
            <form onSubmit={handleAddLogSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Month</label>
                  <select
                    value={addLogStartMonth}
                    onChange={e => {
                      const val = e.target.value;
                      setAddLogStartMonth(val);
                      if (Number(val) > Number(addLogEndMonth)) {
                        setAddLogEndMonth(val);
                      }
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {['January','February','March','April','May','June','July','August','September','October','November','December'].map((name, idx) => (
                      <option key={idx + 1} value={String(idx + 1)}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Month</label>
                  <select
                    value={addLogEndMonth}
                    onChange={e => setAddLogEndMonth(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {['January','February','March','April','May','June','July','August','September','October','November','December']
                      .map((name, idx) => ({ name, value: idx + 1 }))
                      .filter(({ value }) => value >= Number(addLogStartMonth))
                      .map(({ name, value }) => (
                        <option key={value} value={String(value)}>{name}</option>
                      ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <input type="number" required min="2000" max="2100" value={addLogYear}
                  onChange={e => setAddLogYear(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Month</label>
                  <select
                    value={editLogStartMonth}
                    onChange={e => {
                      const val = e.target.value;
                      setEditLogStartMonth(val);
                      if (Number(val) > Number(editLogEndMonth)) {
                        setEditLogEndMonth(val);
                      }
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {['January','February','March','April','May','June','July','August','September','October','November','December'].map((name, idx) => (
                      <option key={idx + 1} value={String(idx + 1)}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Month</label>
                  <select
                    value={editLogEndMonth}
                    onChange={e => setEditLogEndMonth(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {['January','February','March','April','May','June','July','August','September','October','November','December']
                      .map((name, idx) => ({ name, value: idx + 1 }))
                      .filter(({ value }) => value >= Number(editLogStartMonth))
                      .map(({ name, value }) => (
                        <option key={value} value={String(value)}>{name}</option>
                      ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <input type="number" required min="2000" max="2100" value={editLogYear}
                  onChange={e => setEditLogYear(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Device DROID Number</label>
                <input
                  type="text"
                  value={editDroidNumber}
                  onChange={e => {
                    const val = e.target.value;
                    setEditDroidNumber(val.startsWith('DROID-S120-') ? val : 'DROID-S120-');
                  }}
                  placeholder="DROID-S120-"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                />
                <p className="text-xs text-gray-400 mt-1">Alphanumeric suffix after <span className="font-mono">DROID-S120-</span></p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input type="tel" value={editPhone}
                  onChange={e => setEditPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="08012345678"
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
            <div className="text-teal-300 text-xs">Enrollment Portal · Admin</div>
          </div>
        </div>
        <button onClick={() => signOut(auth)} className="text-sm bg-teal-700 hover:bg-teal-600 px-3 py-1.5 rounded-lg">Logout</button>
      </header>

      <div className="max-w-7xl mx-auto p-4">
        <div className="flex flex-wrap gap-2 mb-5">
          {(['enrollments', 'agents', 'enrollmentLog', 'personalizationRecords', 'accountDetails', 'aggregators', 'profile'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm ${tab === t ? 'bg-teal-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}>
              {t === 'enrollments' ? '📋 Enrollment Records' : t === 'agents' ? '👥 Agents' : t === 'enrollmentLog' ? '📊 Enrollment Log' : t === 'personalizationRecords' ? '🎯 Personalization' : t === 'accountDetails' ? '🏦 Account Details' : t === 'aggregators' ? '👤 Aggregators' : '🔐 My Profile'}
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
                  {newRole !== 'AGGREGATOR' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Device ID</label>
                    <input type="text" required value={newDeviceId} onChange={e => setNewDeviceId(e.target.value.slice(0, 20))}
                      placeholder="HENA-315835789326461" maxLength={20}
                      className={inputCls + ' font-mono'} />
                    <p className="text-xs text-gray-400 mt-1">{newDeviceId.length}/20 characters</p>
                  </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                    <input type="tel" required value={newPhone}
                      onChange={e => setNewPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      placeholder="08012345678" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select value={newRole} onChange={e => { setNewRole(e.target.value as 'AGENT' | 'ADMIN' | 'AGGREGATOR'); setNewStateId(''); setNewStateName(''); setNewLgaId(''); setNewLgaName(''); }} className={inputCls}>
                      <option value="AGENT">Agent</option>
                      <option value="ADMIN">Admin</option>
                      <option value="AGGREGATOR">Aggregator</option>
                    </select>
                  </div>
                  {newRole === 'AGENT' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                        <select required value={newStateId} onChange={e => {
                          const s = geoData.find(st => st.id === e.target.value);
                          setNewStateId(e.target.value);
                          setNewStateName(s?.name ?? '');
                          setNewLgaId('');
                          setNewLgaName('');
                        }} className={inputCls}>
                          <option value="">-- Select State --</option>
                          {geoData.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">LGA</label>
                        <select required disabled={!newStateId} value={newLgaId} onChange={e => {
                          const lgas = geoData.find(s => s.id === newStateId)?.lgas ?? [];
                          const l = lgas.find(lg => lg.id === e.target.value);
                          setNewLgaId(e.target.value);
                          setNewLgaName(l?.name ?? '');
                        }} className={inputCls + ' disabled:bg-gray-100'}>
                          <option value="">-- Select LGA --</option>
                          {(geoData.find(s => s.id === newStateId)?.lgas ?? []).map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">Registered Agents</h2>
                    <p className="text-sm text-gray-500 mt-0.5">{filteredAgents.length} of {agents.length} agent{agents.length !== 1 ? 's' : ''}</p>
                  </div>
                  <button onClick={exportAgentsExcel}
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
                  <input type="text" placeholder="Search by name, email, Device ID, or phone..." value={agentSearch}
                    onChange={e => { setAgentSearch(e.target.value); setAgentPage(0); }}
                    className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-50" />
                </div>
              </div>
              {filteredAgents.length === 0 ? (
                <div className="text-center py-16 text-gray-400">{agentSearch ? 'No agents found matching your search.' : 'No agents registered yet.'}</div>
              ) : (
                <div className="overflow-x-auto w-full">
                  <table className="text-sm" style={{ minWidth: '1000px', width: '100%' }}>
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Agent</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Device ID</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Device DROID No.</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Personalization</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Registered</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[160px]">Aggregator</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[200px]">Actions</th>
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
                          <td className="px-4 py-3.5">
                            <span className="font-mono text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded">{a.deviceDroidNumber || '—'}</span>
                          </td>
                          <td className="px-4 py-3.5 text-right font-medium">
                            <span className="inline-flex items-center justify-center bg-teal-50 text-teal-800 border border-teal-200 font-bold text-xs px-2.5 py-1 rounded-full">
                              {(agentTotalsMap[a.id] || 0).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-gray-400 text-xs">{new Date(a.createdAt).toLocaleDateString('en-NG', { dateStyle: 'medium' })}</td>
                          <td className="px-4 py-3.5">
                            {a.aggregatorId
                              ? <span className="text-xs text-teal-700 font-medium">{allAggregators.find(ag => ag.id === a.aggregatorId)?.name ?? a.aggregatorId}</span>
                              : <span className="text-gray-300 text-xs">—</span>}
                            <div className="mt-1">
                              <select
                                value={a.aggregatorId || ''}
                                disabled={assigningAggregatorId === a.id}
                                onChange={e => {
                                  const agg = allAggregators.find(ag => ag.id === e.target.value);
                                  if (agg) handleAssignAggregator(a.id, a.name, agg.id, agg.aggregatorId);
                                }}
                                className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                              >
                                <option value="">-- Assign Aggregator --</option>
                                {allAggregators.map(agg => (
                                  <option key={agg.id} value={agg.id}>{agg.name} ({agg.aggregatorId})</option>
                                ))}
                              </select>
                            </div>
                          </td>
                          <td className="px-3 py-3.5">
                            <div className="flex items-center gap-1 flex-nowrap">
                              <button onClick={() => openEdit(a)}
                                className="text-xs text-teal-600 hover:text-teal-800 border border-teal-200 hover:border-teal-400 bg-teal-50 hover:bg-teal-100 px-2 py-1 rounded transition-colors font-medium whitespace-nowrap">
                                Edit
                              </button>
                              <button onClick={() => setSetPasswordTarget({ uid: a.id, name: a.name, role: 'AGENT' })}
                                className="text-xs text-purple-600 hover:text-purple-800 border border-purple-200 hover:border-purple-400 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded transition-colors font-medium whitespace-nowrap">
                                Set Password
                              </button>
                              <button onClick={() => handlePasswordReset(a.id, a.email)}
                                className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors font-medium whitespace-nowrap">
                                Reset
                              </button>
                              <button onClick={() => handleDeleteUser(a.id, a.name)}
                                className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition-colors font-medium whitespace-nowrap">
                                Delete
                              </button>
                            </div>
                            {resetMsg[a.id] && (
                              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded mt-1 block">{resetMsg[a.id]}</span>
                            )}
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
                                        <td className="px-4 py-3 font-medium text-gray-700">{formatMonthRange(log.startMonth, log.endMonth, log.year)}</td>
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
        {tab === 'personalizationRecords' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">🎯 Bulk Personalization Records</h2>
              <p className="text-sm text-gray-500">Overview and individual records of agent bulk personalization submissions.</p>
            </div>

            {/* Stat Cards */}
            {!loadingAdminPers && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                  <div className="text-xs font-semibold text-teal-800 uppercase tracking-wider mb-1">Grand Total Bulk Personalization</div>
                  <div className="text-3xl font-extrabold text-teal-700">{computeGrandTotal(adminPersRecords).toLocaleString()}</div>
                </div>
                {(() => {
                  const summaries = computeAgentPersonalizationSummaries(adminPersRecords);
                  const avg = summaries.length > 0 ? Math.round(computeGrandTotal(adminPersRecords) / summaries.length) : 0;
                  return (
                    <>
                      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                        <div className="text-xs font-semibold text-purple-800 uppercase tracking-wider mb-1">Active Agents</div>
                        <div className="text-3xl font-extrabold text-purple-700">{summaries.length}</div>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <div className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-1">Average Per Agent</div>
                        <div className="text-3xl font-extrabold text-blue-700">{avg.toLocaleString()}</div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* View Mode Switcher and Controls */}
            {!loadingAdminPers && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                <div className="flex rounded-lg overflow-hidden border border-gray-200 max-w-md">
                  <button
                    onClick={() => setPersViewMode('allRecords')}
                    className={`px-4 py-2 text-xs font-semibold transition-colors ${
                      persViewMode === 'allRecords'
                        ? 'bg-teal-700 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    📋 All Submission Records ({adminPersRecords.length})
                  </button>
                  <button
                    onClick={() => setPersViewMode('agentSummary')}
                    className={`px-4 py-2 text-xs font-semibold transition-colors ${
                      persViewMode === 'agentSummary'
                        ? 'bg-teal-700 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    👤 Total by Agent Summary
                  </button>
                </div>

                {persViewMode === 'agentSummary' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      placeholder="Search agent name..."
                      value={persAgentSearch}
                      onChange={e => setPersAgentSearch(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-50"
                    />
                    <button
                      onClick={exportAgentPersonalizationExcel}
                      className="flex items-center gap-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Export Summary Excel
                    </button>
                  </div>
                )}
                
                {persViewMode === 'allRecords' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={exportAllPersonalizationRecordsExcel}
                      className="flex items-center gap-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Export All Records Excel
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Loading */}
            {loadingAdminPers && (
              <div className="flex items-center justify-center py-10 text-gray-400 gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Loading…
              </div>
            )}

            {/* Error */}
            {adminPersError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-4">{adminPersError}</div>
            )}

            {/* Empty state */}
            {!loadingAdminPers && !adminPersError && adminPersRecords.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-8">No personalization records found.</p>
            )}

            {/* View 1: Agent Personalization Summary */}
            {!loadingAdminPers && persViewMode === 'agentSummary' && adminPersRecords.length > 0 && (() => {
              const summaries = computeAgentPersonalizationSummaries(adminPersRecords);
              const filteredSummaries = summaries.filter(s =>
                !persAgentSearch || s.agentName.toLowerCase().includes(persAgentSearch.toLowerCase())
              );
              if (filteredSummaries.length === 0) {
                return <p className="text-gray-400 text-sm text-center py-8">No agents found matching search.</p>;
              }
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Agent Name</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Personalization</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Submissions</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date Range</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredSummaries.map((s, i) => (
                        <tr key={s.agentId} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-teal-50 transition-colors`}>
                          <td className="px-4 py-3.5 font-semibold text-gray-800">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm">
                                {s.agentName?.charAt(0).toUpperCase()}
                              </div>
                              <span>{s.agentName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right font-bold text-teal-700 text-base">
                            <span className="inline-flex items-center justify-center bg-teal-100 text-teal-800 font-bold text-sm px-3.5 py-1 rounded-full">
                              {s.totalCount.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center text-gray-600 font-medium">
                            {s.recordCount} entry{s.recordCount !== 1 ? 'ies' : ''}
                          </td>
                          <td className="px-4 py-3.5 text-gray-500 text-xs font-mono">
                            {s.dateRange}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* View 2: All Individual Records Table */}
            {!loadingAdminPers && persViewMode === 'allRecords' && adminPersRecords.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Agent</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Count</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {adminPersRecords.map((r, i) => (
                      <tr key={r.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-teal-50 transition-colors`}>
                        <td className="px-4 py-3 text-gray-700">{r.agentName}</td>
                        <td className="px-4 py-3 font-medium text-gray-700">{r.personalizationDate}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center justify-center bg-teal-100 text-teal-800 font-bold text-sm px-3 py-1 rounded-full">
                            {r.count.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEditPersRecord(r)}
                              className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1 rounded-lg transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeletePersRecord(r)}
                              disabled={deletingPersId === r.id}
                              className="text-xs bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {deletingPersId === r.id ? 'Deleting…' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Edit modal */}
            {editPersRecord && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
                  <h3 className="text-base font-semibold text-gray-800 mb-4">Edit Personalization Record</h3>
                  <form onSubmit={handleEditPersSave} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                      <input
                        type="date"
                        value={editPersDate}
                        onChange={e => setEditPersDate(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Count</label>
                      <input
                        type="number"
                        min="0"
                        max="999999"
                        value={editPersCount}
                        onChange={e => setEditPersCount(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    {editPersError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{editPersError}</div>
                    )}
                    <div className="flex gap-3 pt-1">
                      <button
                        type="submit"
                        disabled={editPersSaving}
                        className="flex-1 bg-teal-700 hover:bg-teal-800 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-60 text-sm"
                      >
                        {editPersSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditPersRecord(null)}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 rounded-lg transition-colors text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
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
                                {(a.accountNumber || a.accountName || a.bankName) && (
                                  <button onClick={() => handleDeleteAccountDetails(a)}
                                    className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors font-medium">
                                    Delete
                                  </button>
                                )}
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

        {tab === 'profile' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 max-w-lg">
            <h2 className="text-lg font-bold text-gray-800 mb-1">My Profile</h2>
            <p className="text-sm text-gray-500 mb-5">Update your admin account password.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input type="text" value={_user.displayName || ''} disabled
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 mb-4" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input type="text" value={_user.email || ''} disabled
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 mb-4" />
            </div>
            <ChangePasswordForm user={_user} />
          </div>
        )}

        {tab === 'aggregators' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
            {/* Edit Aggregator Modal */}
            {editAggregator && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Edit Aggregator</h3>
                  <form onSubmit={handleEditAggregatorSave} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                      <input type="text" required value={editAggName} onChange={e => setEditAggName(e.target.value)}
                        className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                      <input type="tel" value={editAggPhone}
                        onChange={e => setEditAggPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                        placeholder="08012345678" className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input type="text" value={editAggregator.email} disabled
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Aggregator ID</label>
                      <input type="text" value={editAggregator.aggregatorId} disabled
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 font-mono" />
                    </div>
                    {editAggError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{editAggError}</div>}
                    <div className="flex gap-3 pt-2">
                      <button type="submit" disabled={editAggSaving}
                        className="flex-1 bg-teal-700 hover:bg-teal-800 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 text-sm">
                        {editAggSaving ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button type="button" onClick={() => setEditAggregator(null)}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-lg transition-colors text-sm">
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Aggregators</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{aggregators.length} aggregator{aggregators.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={() => { setShowAddAggregator(!showAddAggregator); setAddAggError(''); setAddAggSuccess(''); }}
                  className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${showAddAggregator ? 'bg-gray-100 text-gray-600' : 'bg-teal-700 text-white hover:bg-teal-800'}`}>
                  {showAddAggregator ? '✕ Cancel' : '+ Add Aggregator'}
                </button>
              </div>
              {/* Invite Code Management */}
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <h3 className="text-sm font-semibold text-amber-800 mb-1">Aggregator Invite Code</h3>
                <p className="text-xs text-amber-700 mb-3">Only people with this code can self-register as an aggregator. Share it only with genuine aggregators.</p>
                <form onSubmit={handleSaveInviteCode} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Current Code</label>
                    <input type="text" value={inviteCodeInput} onChange={e => setInviteCodeInput(e.target.value)}
                      placeholder="Set an invite code..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono" />
                  </div>
                  <button type="submit" disabled={savingInviteCode}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-60 whitespace-nowrap">
                    {savingInviteCode ? 'Saving...' : 'Save Code'}
                  </button>
                </form>
                {inviteCode && <p className="text-xs text-amber-700 mt-2">Active code: <span className="font-mono font-bold">{inviteCode}</span></p>}
                {!inviteCode && <p className="text-xs text-red-600 mt-2">⚠️ No invite code set — aggregator self-registration is currently disabled.</p>}
                {inviteCodeMsg && <p className="text-xs text-green-700 mt-2">{inviteCodeMsg}</p>}
              </div>
              {showAddAggregator && (
                <form onSubmit={handleAddAggregator} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input type="text" required value={addAggName} onChange={e => setAddAggName(e.target.value)} placeholder="Enter full name" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <input type="email" required value={addAggEmail} onChange={e => setAddAggEmail(e.target.value)} placeholder="aggregator@example.com" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                    <input type="tel" required value={addAggPhone} onChange={e => setAddAggPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="08012345678" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <select required value={addAggStateId}
                      onChange={e => {
                        const s = geoData.find(st => st.id === e.target.value);
                        setAddAggStateId(e.target.value); setAddAggStateName(s?.name ?? '');
                        setAddAggLgaId(''); setAddAggLgaName('');
                      }}
                      className={inputCls}>
                      <option value="">-- Select State --</option>
                      {geoData.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Local Government Area</label>
                    <select required disabled={!addAggStateId} value={addAggLgaId}
                      onChange={e => {
                        const lgas = geoData.find(s => s.id === addAggStateId)?.lgas ?? [];
                        const l = lgas.find(lg => lg.id === e.target.value);
                        setAddAggLgaId(e.target.value); setAddAggLgaName(l?.name ?? '');
                      }}
                      className={inputCls + ' disabled:bg-gray-100'}>
                      <option value="">-- Select LGA --</option>
                      {(geoData.find(s => s.id === addAggStateId)?.lgas ?? []).map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Office Address</label>
                    <textarea required value={addAggOfficeAddress} onChange={e => setAddAggOfficeAddress(e.target.value)}
                      placeholder="Enter office address" rows={2}
                      className={inputCls + ' resize-none'} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input type="password" required value={addAggPassword} onChange={e => setAddAggPassword(e.target.value)} placeholder="Min. 6 characters" className={inputCls} />
                  </div>
                  <div className="sm:col-span-2">
                    {addAggError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-3">{addAggError}</div>}
                    {addAggSuccess && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2 mb-3">{addAggSuccess}</div>}
                    <button type="submit" disabled={addAggLoading}
                      className="bg-teal-700 hover:bg-teal-800 text-white font-medium px-6 py-2.5 rounded-lg transition-colors disabled:opacity-60 text-sm">
                      {addAggLoading ? 'Creating...' : 'Create Aggregator'}
                    </button>
                  </div>
                </form>
              )}
              <div className="relative">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input type="text" placeholder="Search by name, email, or Aggregator ID..." value={aggregatorSearch}
                  onChange={e => setAggregatorSearch(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-50" />
              </div>
            </div>
            {loadingAggregators ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <svg className="animate-spin h-6 w-6 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Loading aggregators...
              </div>
            ) : (() => {
              const filtered = aggregators.filter(a => {
                const q = aggregatorSearch.toLowerCase();
                return !q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || a.aggregatorId.toLowerCase().includes(q);
              });
              if (filtered.length === 0) return <div className="text-center py-16 text-gray-400">{aggregatorSearch ? 'No aggregators found.' : 'No aggregators registered yet.'}</div>;
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Aggregator ID</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">State / LGA</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Office Address</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filtered.map((agg, i) => (
                        <tr key={agg.id} className={`hover:bg-teal-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm">
                                {agg.name?.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-semibold text-gray-800">{agg.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-gray-500">{agg.email}</td>
                          <td className="px-4 py-3.5">
                            <span className="font-mono text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2 py-1 rounded">{agg.aggregatorId}</span>
                          </td>
                          <td className="px-4 py-3.5 text-gray-500 text-xs">{agg.phone || <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3.5 text-gray-600 text-xs">
                            {agg.profileStateName || <span className="text-gray-300">—</span>}
                            {agg.profileLgaName && <span className="text-gray-400"> / {agg.profileLgaName}</span>}
                          </td>
                          <td className="px-4 py-3.5 text-gray-600 text-xs max-w-[180px]">
                            {(agg as any).officeAddress
                              ? <span title={(agg as any).officeAddress}>{(agg as any).officeAddress.length > 40 ? (agg as any).officeAddress.slice(0, 40) + '…' : (agg as any).officeAddress}</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex gap-1.5">
                                <button onClick={() => openEditAggregator(agg)}
                                  className="text-xs text-teal-600 hover:text-teal-800 border border-teal-200 hover:border-teal-400 bg-teal-50 hover:bg-teal-100 px-2.5 py-1.5 rounded-lg transition-colors font-medium">
                                  Edit
                                </button>
                                <button onClick={() => setSetPasswordTarget({ uid: agg.id, name: agg.name, role: 'AGGREGATOR' })}
                                  className="text-xs text-purple-600 hover:text-purple-800 border border-purple-200 hover:border-purple-400 bg-purple-50 hover:bg-purple-100 px-2.5 py-1.5 rounded-lg transition-colors font-medium">
                                  Set Password
                                </button>
                                <button onClick={() => handleAggregatorPasswordReset(agg.id, agg.email)}
                                  className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors font-medium">
                                  Reset Password
                                </button>
                                <button onClick={() => handleDeleteAggregator(agg.id, agg.name)}
                                  className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors font-medium">
                                  Delete
                                </button>
                              </div>
                              {aggResetMsg[agg.id] && (
                                <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">{aggResetMsg[agg.id]}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
