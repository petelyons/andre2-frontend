'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from "next/image";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for sessionId in URL
    const urlSessionId = searchParams?.get('sessionId');
    if (urlSessionId) {
      console.log('[Home] Found sessionId in URL:', urlSessionId);
      localStorage.setItem('sessionId', urlSessionId);
    }
    const sessionId = urlSessionId || localStorage.getItem('sessionId');
    console.log('[Home] Checking sessionId:', sessionId);
    if (!sessionId) {
      console.log('[Home] No sessionId found, redirecting to /login');
      router.push('/login');
      return;
    }
    fetch(`http://localhost:3001/api/session/${sessionId}`)
      .then(res => {
        console.log('[Home] Backend /api/session response status:', res.status);
        return res.json();
      })
      .then(data => {
        console.log('[Home] Backend /api/session response data:', data);
        if (data && data.loggedIn) {
          console.log('[Home] Session is logged in, redirecting to /main');
          router.push('/main');
        } else {
          console.log('[Home] Session not logged in, redirecting to /login');
          router.push('/login');
        }
      })
      .catch((err) => {
        console.error('[Home] Error checking session:', err);
        router.push('/login');
      })
      .finally(() => setLoading(false));
  }, [router, searchParams]);

  if (loading) return null;
  return null;
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
