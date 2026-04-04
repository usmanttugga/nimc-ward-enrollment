const BASE = '/api';

function authHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeader(), ...(options.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res;
}

export async function register(email: string, password: string, name: string) {
  const res = await request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) });
  return res.json();
}

export async function login(email: string, password: string) {
  const res = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  return res.json();
}

export async function getStates() {
  const res = await request('/geo/states');
  return res.json();
}

export async function getLgas(stateId: string) {
  const res = await request(`/geo/states/${stateId}/lgas`);
  return res.json();
}

export async function getWards(lgaId: string) {
  const res = await request(`/geo/lgas/${lgaId}/wards`);
  return res.json();
}

export async function submitEnrollment(data: object) {
  const res = await request('/enrollment', { method: 'POST', body: JSON.stringify(data) });
  return res.json();
}

export async function getMyEnrollments() {
  const res = await request('/enrollment/my');
  return res.json();
}

export async function getAdminEnrollments() {
  const res = await request('/admin/enrollments');
  return res.json();
}

export async function getAdminAgents() {
  const res = await request('/admin/agents');
  return res.json();
}

export function downloadCsv() {
  const token = localStorage.getItem('token');
  const a = document.createElement('a');
  a.href = `${BASE}/admin/enrollments/export`;
  // fetch with auth header and trigger download
  fetch(`${BASE}/admin/enrollments/export`, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = 'enrollments.csv';
      a.click();
      URL.revokeObjectURL(url);
    });
}
