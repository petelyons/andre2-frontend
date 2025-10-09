'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function Login() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        // If already logged in, redirect to /main
        const sessionId = localStorage.getItem('sessionId');
        if (sessionId) {
            fetch(`http://localhost:3001/api/session/${sessionId}`)
                .then(res => res.json())
                .then(data => {
                    if (data && data.loggedIn) {
                        router.push('/main');
                        return;
                    }
                });
        }
        // Handle Spotify callback with code
        if (searchParams) {
            const code = searchParams.get('code');
            if (code) {
                fetch(`http://localhost:3001/api/spotify/callback?code=${code}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.access_token) {
                            localStorage.setItem('spotify_access_token', data.access_token);
                            localStorage.setItem('spotify_refresh_token', data.refresh_token);
                            router.push('/main');
                        } else {
                            alert('Failed to get Spotify tokens');
                        }
                    });
            }
        }
    }, [searchParams, router]);

    const handleSpotifyLogin = () => {
        window.location.href = 'http://localhost:3001/api/spotify/login';
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
            const res = await fetch('http://localhost:3001/api/listener-login', {
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
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Sign in
                    </h2>
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
                <form className="space-y-4" onSubmit={handleListenerLogin}>
                    <input
                        type="text"
                        placeholder="Listener Name"
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
                        Login as Listener Only
                    </button>
                </form>
            </div>
        </div>
    );
} 