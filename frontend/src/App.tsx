import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import AuthPage from './pages/AuthPage';
import AgentPage from './pages/AgentPage';
import AdminPage from './pages/AdminPage';
import AggregatorPage from './pages/AggregatorPage';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'AGENT' | 'ADMIN' | 'AGGREGATOR' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const snap = await getDoc(doc(db, 'users', u.uid));
        setRole(snap.exists() ? snap.data().role : 'AGENT');
      } else {
        setRole(null);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center">
        <div className="text-green-700 text-lg font-medium">Loading...</div>
      </div>
    );
  }

  if (!user || !role) return <AuthPage />;
  if (role === 'ADMIN') return <AdminPage user={user} />;
  if (role === 'AGGREGATOR') return <AggregatorPage user={user} />;
  return <AgentPage user={user} />;
}
