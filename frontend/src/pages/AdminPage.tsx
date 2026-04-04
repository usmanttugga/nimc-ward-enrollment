import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { signOut } from 'firebase/auth';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import Logo from '../components/Logo';

interface Props { user: User; }

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
}

interface Agent {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export default function AdminPage({ user: _user }: Props) {
  const [tab, setTab] = useState<'enrollments' | 'agents'>('enrollments');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    if (tab === 'enrollments') {
      const q = query(collection(db, 'enrollments'), orderBy('submittedAt', 'desc'));
      getDocs(q).then(snap => {
        setEnrollments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Enrollment)));
      }).finally(() => setLoading(false));
    } else {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      getDocs(q).then(snap => {
        setAgents(snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Agent & { role: string }))
          .filter((u: any) => u.role === 'AGENT')
        );
      }).finally(() => setLoading(false));
    }
  }, [tab]);

  const filtered = enrollments.filter(r => {
    const q = search.toLowerCase();
    return !q || [r.agentName, r.stateName, r.lgaName, r.wardName, r.deviceId]
      .some(v => v?.toLowerCase().includes(q));
  });

  const totalFigures = filtered.reduce((sum, r) => sum + (r.dailyFigures || 0), 0);

  function exportCsv() {
    const headers = ['Date', 'Agent', 'Email', 'State', 'LGA', 'Ward', 'Device ID', 'Daily Figures', 'Issues/Complaints', 'Submitted At'];
    const rows = filtered.map(r => [
      r.date, r.agentName, r.agentEmail, r.stateName, r.lgaName, r.wardName,
      r.deviceId, r.dailyFigures, r.issuesComplaints || '', r.submittedAt
    ]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'enrollments.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-teal-800 text-white px-4 py-3 flex items-center justify-between shadow">
        <div className="flex items-center gap-3">
          <Logo size={38} />
          <div>
            <div className="font-black text-sm leading-tight">
              <span className="text-pink-300">2 PLUS </span>
              <span className="text-teal-200">TECHNOLOGIES</span>
            </div>
            <div className="text-teal-300 text-xs">NIMC Ward Enrollment · Admin</div>
          </div>
        </div>
        <button onClick={() => signOut(auth)} className="text-sm bg-teal-700 hover:bg-teal-600 px-3 py-1.5 rounded-lg">
          Logout
        </button>
      </header>

      <div className="max-w-6xl mx-auto p-4">
        <div className="flex gap-2 mb-4">
          {(['enrollments', 'agents'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t ? 'bg-teal-700 text-white' : 'bg-white text-gray-600 border'}`}>
              {t === 'enrollments' ? 'Enrollment Records' : 'Agents'}
            </button>
          ))}
        </div>

        {tab === 'enrollments' && (
          <div className="bg-white rounded-xl shadow">
            <div className="p-4 border-b flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-800">Enrollment Records</h2>
                <p className="text-sm text-gray-500">{filtered.length} records · {totalFigures.toLocaleString()} total enrollees</p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <input type="text" placeholder="Search agent, state, LGA, ward..." value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 sm:w-64 focus:outline-none focus:ring-2 focus:ring-green-500" />
                <button onClick={exportCsv}
                  className="bg-teal-700 hover:bg-teal-800 text-white text-sm px-4 py-2 rounded-lg whitespace-nowrap">
                  ↓ Export CSV
                </button>
              </div>
            </div>
            {loading ? (
              <div className="text-center py-12 text-gray-400">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No records found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                    <tr>
                      {['Date', 'Agent', 'State', 'LGA', 'Ward', 'Device ID', 'Figures', 'Issues'].map(h => (
                        <th key={h} className={`px-4 py-3 ${h === 'Figures' ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">{r.date}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{r.agentName}</div>
                          <div className="text-xs text-gray-400">{r.agentEmail}</div>
                        </td>
                        <td className="px-4 py-3">{r.stateName}</td>
                        <td className="px-4 py-3">{r.lgaName}</td>
                        <td className="px-4 py-3">{r.wardName}</td>
                        <td className="px-4 py-3 font-mono text-xs">{r.deviceId}</td>
                        <td className="px-4 py-3 text-right font-semibold text-teal-700">{r.dailyFigures?.toLocaleString()}</td>
                        <td className="px-4 py-3 max-w-xs">
                          {r.issuesComplaints
                            ? <span className="text-orange-600 text-xs">{r.issuesComplaints}</span>
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
          <div className="bg-white rounded-xl shadow">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-800">Registered Agents</h2>
              <p className="text-sm text-gray-500">{agents.length} agents</p>
            </div>
            {loading ? (
              <div className="text-center py-12 text-gray-400">Loading...</div>
            ) : agents.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No agents registered yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Name</th>
                      <th className="px-4 py-3 text-left">Email</th>
                      <th className="px-4 py-3 text-left">Registered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {agents.map(a => (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{a.name}</td>
                        <td className="px-4 py-3 text-gray-500">{a.email}</td>
                        <td className="px-4 py-3 text-gray-400">{new Date(a.createdAt).toLocaleDateString()}</td>
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
