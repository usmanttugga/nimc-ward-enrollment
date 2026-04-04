import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { signOut } from 'firebase/auth';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import * as XLSX from 'xlsx';
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
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
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

  const hasFilters = search || dateFrom || dateTo;

  const filtered = enrollments.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || [r.agentName, r.stateName, r.lgaName, r.wardName, r.deviceId]
      .some(v => v?.toLowerCase().includes(q));
    const matchFrom = !dateFrom || r.date >= dateFrom;
    const matchTo = !dateTo || r.date <= dateTo;
    return matchSearch && matchFrom && matchTo;
  });

  const totalFigures = filtered.reduce((sum, r) => sum + (r.dailyFigures || 0), 0);

  function clearFilters() {
    setSearch('');
    setDateFrom('');
    setDateTo('');
  }

  function exportCsv() {
    // Use the dateFrom filter as the report date, fallback to today
    const reportDateRaw = dateFrom || new Date().toISOString().split('T')[0];
    const [yr, mo, dy] = reportDateRaw.split('-');
    const reportDateFormatted = `${dy}/${mo}/${yr}`;
    const fileDate = `${dy}-${mo}-${yr}`;
    const fileName = `2PLUS TECH WARD ENROLLMENT ${fileDate}.xlsx`;

    const wb = XLSX.utils.book_new();

    // Row layout matching the NIMC template exactly:
    // Row 1: Title (merged A1:G1)
    // Row 2: empty
    // Row 3: "Name of FEP:" (A3), merged value "2 PLUS TECHNOLOGIES" (B3:D3), "Date of Reporting:" (E3), merged value date (F3:G3)
    // Row 4: empty
    // Row 5: Column headers
    // Row 6+: Data

    const wsData: (string | number)[][] = [
      ['Daily Ward Enrollment Report', '', '', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['Name of FEP: 2 PLUS TECHNOLOGIES', '', '', '', 'Date of Reporting: ' + reportDateFormatted, '', ''],
      ['', '', '', '', '', '', ''],
      ['S/No.', 'States', 'Local Govt Areas', 'Ward', 'Device ID', 'Daily Enrolment Figures', 'Issues/Complaint'],
    ];

    filtered.forEach((r, i) => {
      wsData.push([
        i + 1,
        r.stateName,
        r.lgaName,
        r.wardName,
        r.deviceId,
        r.dailyFigures,
        r.issuesComplaints || '',
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Merges
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },  // Title: A1:G1
      { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },  // FEP: A3:D3
      { s: { r: 2, c: 4 }, e: { r: 2, c: 6 } },  // Date: E3:G3
    ];

    // Column widths
    ws['!cols'] = [
      { wch: 6 },   // S/No.
      { wch: 20 },  // States
      { wch: 25 },  // LGA
      { wch: 25 },  // Ward
      { wch: 18 },  // Device ID
      { wch: 22 },  // Daily Figures
      { wch: 40 },  // Issues
    ];

    // Cell styles
    const titleCell = ws['A1'];
    if (titleCell) {
      titleCell.s = {
        font: { bold: true, sz: 14 },
        alignment: { horizontal: 'center', vertical: 'center' },
        fill: { fgColor: { rgb: '1F7A6E' } },
      };
    }

    // Style header row (row 5, index 4)
    ['A5', 'B5', 'C5', 'D5', 'E5', 'F5', 'G5'].forEach(cell => {
      if (ws[cell]) {
        ws[cell].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: 'D9EAD3' } },
          alignment: { horizontal: 'center', wrapText: true },
          border: {
            top: { style: 'thin' }, bottom: { style: 'thin' },
            left: { style: 'thin' }, right: { style: 'thin' },
          },
        };
      }
    });

    XLSX.utils.book_append_sheet(wb, ws, 'FEP WARD ENROLMENT TEMPLATE');
    XLSX.writeFile(wb, fileName);
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-teal-800 text-white px-4 py-3 flex items-center justify-between shadow-lg">
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
        <button onClick={() => signOut(auth)}
          className="text-sm bg-teal-700 hover:bg-teal-600 px-3 py-1.5 rounded-lg transition-colors">
          Logout
        </button>
      </header>

      <div className="max-w-7xl mx-auto p-4">
        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {(['enrollments', 'agents'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm ${tab === t ? 'bg-teal-700 text-white shadow-teal-200' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}>
              {t === 'enrollments' ? '📋 Enrollment Records' : '👥 Agents'}
            </button>
          ))}
        </div>

        {tab === 'enrollments' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
            {/* Header + Filters */}
            <div className="p-5 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Enrollment Records</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {filtered.length} record{filtered.length !== 1 ? 's' : ''} ·
                    <span className="text-teal-600 font-semibold"> {totalFigures.toLocaleString()} total enrollees</span>
                  </p>
                </div>
                <button onClick={exportCsv}
                  className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export Excel
                </button>
              </div>

              {/* Filter row */}
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[180px]">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input type="text" placeholder="Search agent, state, LGA, ward, device..." value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-50" />
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <span className="text-xs font-medium">From</span>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-50" />
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <span className="text-xs font-medium">To</span>
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

            {/* Table */}
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
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="font-medium">No records found</p>
                {hasFilters && <p className="text-sm mt-1">Try clearing the filters</p>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Agent</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Device ID</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Enrollees</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Issues</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map((r, i) => (
                      <tr key={r.id} className={`hover:bg-teal-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="font-medium text-gray-700">{r.date}</span>
                        </td>
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
                          {r.issuesComplaints ? (
                            <span className="inline-flex items-center gap-1 text-orange-600 text-xs bg-orange-50 px-2 py-1 rounded-full">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              {r.issuesComplaints.length > 40 ? r.issuesComplaints.slice(0, 40) + '…' : r.issuesComplaints}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
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
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Registered Agents</h2>
              <p className="text-sm text-gray-500 mt-0.5">{agents.length} agent{agents.length !== 1 ? 's' : ''} registered</p>
            </div>
            {loading ? (
              <div className="text-center py-16 text-gray-400">Loading...</div>
            ) : agents.length === 0 ? (
              <div className="text-center py-16 text-gray-400">No agents registered yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Agent</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Registered</th>
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
                        <td className="px-4 py-3.5 text-gray-400 text-xs">{new Date(a.createdAt).toLocaleDateString('en-NG', { dateStyle: 'medium' })}</td>
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
