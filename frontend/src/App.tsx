import { useState, useEffect } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
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
  const [noProfile, setNoProfile] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setNoProfile(false);
      if (u) {
        // Retry up to 5 times with 500ms delay to handle the race condition
        // where onAuthStateChanged fires before the Firestore user doc is written
        // (e.g. during aggregator self-registration).
        let snap = await getDoc(doc(db, 'users', u.uid));
        let attempts = 0;
        while (!snap.exists() && attempts < 5) {
          await new Promise(res => setTimeout(res, 500));
          snap = await getDoc(doc(db, 'users', u.uid));
          attempts++;
        }
        if (!snap.exists()) {
          // Firestore profile was deleted (e.g. admin deleted this account).
          // Sign the user out immediately so they can't access any page.
          setNoProfile(true);
          await signOut(auth);
        } else {
          setRole(snap.data().role);
        }
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

  if (noProfile) {
    return (
      <div className="min-h-screen bg-teal-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Account Deleted</h2>
          <p className="text-sm text-gray-500 mb-6">This account has been removed. Please contact the administrator if you believe this is an error.</p>
          <button onClick={() => { setNoProfile(false); }}
            className="w-full bg-teal-700 hover:bg-teal-800 text-white font-medium py-2.5 rounded-lg transition-colors text-sm">
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (!user || !role) return <AuthPage />;
  if (role === 'ADMIN') return <AdminPage user={user} />;
  if (role === 'AGGREGATOR') return <AggregatorPage user={user} />;
  return <AgentPage user={user} />;
}
