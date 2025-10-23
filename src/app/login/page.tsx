'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        // If already logged in, redirect to /main
        const sessionId = localStorage.getItem('sessionId');
        if (sessionId) {
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/session/${sessionId}`)
                .then(res => res.json())
                .then(data => {
                    if (data && data.loggedIn) {
                        router.push('/main');
                        return;
                    }
                });
        }
        // Handle Spotify callback redirect (Spotify redirects with sessionId)
        if (searchParams) {
            const sessionId = searchParams.get('sessionId');
            if (sessionId) {
                localStorage.setItem('sessionId', sessionId);
                router.push('/main');
            }
        }
    }, [searchParams, router]);

    const handleSpotifyLogin = () => {
        window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/api/spotify/login`;
    };

    // Listener login state and handler
    const [listenerName, setListenerName] = useState('');
    const [listenerEmail, setListenerEmail] = useState('');
    const [listenerError, setListenerError] = useState('');
    const handleListenerLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setListenerError('');
        if (!listenerName || !listenerEmail) {
            setListenerError('Name and email are required.');
            return;
        }
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/listener-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: listenerName, email: listenerEmail })
            });
            const data = await res.json();
            if (res.ok && data.sessionId) {
                localStorage.setItem('sessionId', data.sessionId);
                localStorage.setItem('listener_name', listenerName);
                localStorage.setItem('listener_email', listenerEmail);
                router.push('/main');
            } else {
                setListenerError(data.error || 'Login failed');
            }
        } catch (err) {
            setListenerError('Login failed');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
                <div>
                    <div className="mt-6 flex items-center justify-center gap-3">
                        <img
                            src="/Andre2.png"
                            alt="Andre Too"
                            className="h-12 w-12 rounded"
                        />
                        <h2 className="text-3xl font-extrabold text-gray-900">Sign in</h2>
                    </div>
                </div>
                <button
                    onClick={handleSpotifyLogin}
                    className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                    Login with Spotify
                </button>
                <div className="flex items-center my-4">
                    <div className="flex-grow border-t border-gray-300" />
                    <span className="mx-2 text-gray-400">or</span>
                    <div className="flex-grow border-t border-gray-300" />
                </div>
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-700">Login as Offline Contributor</h3>
                    <p className="text-sm text-gray-600">
                        Use this option to add tracks to the queue and like songs. Note: You won't be able to play music with this login method.
                    </p>
                    <form className="space-y-4" onSubmit={handleListenerLogin}>
                        <input
                            type="text"
                            placeholder="User Name"
                            value={listenerName}
                            onChange={e => setListenerName(e.target.value)}
                            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <input
                            type="email"
                            placeholder="Email"
                            value={listenerEmail}
                            onChange={e => setListenerEmail(e.target.value)}
                            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        {listenerError && <div className="text-red-500 text-sm">{listenerError}</div>}
                        <button
                            type="submit"
                            className="w-full py-2 px-4 rounded bg-blue-500 text-white font-semibold hover:bg-blue-600"
                        >
                            Login as Offline Contributor
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default function Login() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <LoginContent />
        </Suspense>
    );
}