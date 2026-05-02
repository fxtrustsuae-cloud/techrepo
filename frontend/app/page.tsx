'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '52px', height: '52px',
          background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
          borderRadius: '14px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '24px', fontWeight: '800', color: 'white',
          margin: '0 auto 16px',
          boxShadow: '0 8px 40px rgba(59,130,246,0.4)',
        }}>T</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading TechAnalysis Pro...</div>
      </div>
    </div>
  );
}
