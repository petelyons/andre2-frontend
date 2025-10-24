'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

function Toast({ message, onClose }: { message: string, onClose: () => void }) {
    useEffect(() => {
        const timer = setTimeout(onClose, 1500);
        return () => clearTimeout(timer);
    }, [onClose]);
    return (
        <div className="fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded shadow z-50 animate-fade-in cursor-pointer" onClick={onClose}>
            {message}
        </div>
    );
}

function AirhornModal({ open, onClose, onSelect }: { open: boolean, onClose: () => void, onSelect: (name: string) => void }) {
  const [airhorns, setAirhorns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      setError(null);
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/airhorns`)
        .then(res => res.json())
        .then(data => {
          setAirhorns(Array.isArray(data.airhorns) ? data.airhorns : []);
          setLoading(false);
        })
        .catch(() => {
          setError('Failed to load airhorns');
          setLoading(false);
        });
    } else {
      setAirhorns([]);
      setError(null);
    }
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(0,0,0,0.10)" }}>
      <div className="bg-white rounded-lg shadow-lg px-6 py-4 max-w-2xl w-full max-h-[80vh] flex flex-col">
        <h2 className="text-lg font-bold mb-4 text-center">Choose an Airhorn</h2>
        {loading ? (
          <div className="text-gray-500 text-center py-8">Loading...</div>
        ) : error ? (
          <div className="text-red-500 text-center py-8">{error}</div>
        ) : (
          <div className="overflow-y-auto flex-1 mb-4">
            {airhorns.length === 0 ? (
              <div className="text-gray-400 text-center py-8">No airhorns found</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {airhorns.map(name => (
                  <button
                    key={name}
                    className="px-3 py-2 text-sm rounded bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 transition-colors text-center truncate"
                    onClick={() => { onSelect(name); onClose(); }}
                    title={name.replace(/-/g, ' ').replace(/_/g, ' ')}
                  >
                    {name.replace(/-/g, ' ').replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button className="mt-2 px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 transition-colors" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// JamCount component
function JamCount({ count }: { count: number }) {
    if (count > 50) {
        // Arbitrary cap for flaming heart
        return <span title={count + ' jams'}>❤️‍🔥</span>;
    }
    const blue = Math.floor(count / 10);
    const green = Math.floor((count % 10) / 5);
    const red = count % 5;
    return (
        <span className="flex flex-row gap-0.5 items-center" title={count + ' jams'}>
            {Array(blue).fill(0).map((_, i) => <span key={'b'+i}>💙</span>)}
            {Array(green).fill(0).map((_, i) => <span key={'g'+i}>💚</span>)}
            {Array(red).fill(0).map((_, i) => <span key={'r'+i}>❤️</span>)}
        </span>
    );
}

export default function Main() {
    const [sessionId, setSessionId] = useState<string>('');
    const [trackId, setTrackId] = useState('');
    const [tracks, setTracks] = useState<any[]>([]);
    const [connected, setConnected] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const [mode, setMode] = useState<'master_play' | 'master_pause'>('master_pause');
    const [sessionMode, setSessionMode] = useState<'session_play' | 'session_pause'>('session_pause');
    const [currentlyPlayingTrack, setCurrentlyPlayingTrack] = useState<any>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [reconnectAttempts, setReconnectAttempts] = useState(0);
    const router = useRouter();
    const [masterUserSessionId, setMasterUserSessionId] = useState<string | null>(null);
    const [connectedSessions, setConnectedSessions] = useState<Array<{
        sessionId: string;
        userId: string | null;
        name: string;
        email: string;
        isMaster: boolean;
    }>>([]);
    // Master-only: Load random liked tracks
    const [loadingRandomLiked, setLoadingRandomLiked] = useState(false);
    const [airhornModalOpen, setAirhornModalOpen] = useState(false);
    const airhornAudioRef = useRef<HTMLAudioElement | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    // Add play history state
    const [playHistory, setPlayHistory] = useState<any[]>([]);
    // Add sidebar tab state: 0 = history, 1 = users, 2 = play history
    const [sidebarTab, setSidebarTab] = useState(0);
    const [prominentToast, setProminentToast] = useState<string | null>(null);
    const closeToast = useCallback(() => setToast(null), []);
    const closeProminentToast = useCallback(() => setProminentToast(null), []);
    const [canTakeMasterControl, setCanTakeMasterControl] = useState(false);
    const [fallbackInfo, setFallbackInfo] = useState<{ url: string; name: string; trackCount: number } | null>(null);

    // WebSocket connect logic with auto-reconnect
    const connectWebSocket = useCallback(() => {
        const sessionId = localStorage.getItem('sessionId');
        // Construct WebSocket URL from API URL
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const wsUrl = apiUrl.replace(/^http/, 'ws') + '/websocket';
        
        console.log('=== CONNECTING TO WEBSOCKET ===', {
            sessionId,
            wsUrl,
            currentState: wsRef.current?.readyState,
        });
        
        // Only close if we have a different connection or if it's in a closing/closed state
        if (wsRef.current && (wsRef.current.readyState === WebSocket.CLOSED || wsRef.current.readyState === WebSocket.CLOSING)) {
            console.log('Closing old WebSocket connection');
            wsRef.current.close();
            wsRef.current = null;
        }
        
        // Don't create a new connection if we already have an open one
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            console.log('WebSocket already open, skipping reconnect');
            return;
        }
        
        console.log(`Creating new WebSocket connection to: ${wsUrl}`);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('=== WEBSOCKET CONNECTED ===');
            setConnected(true);
            setReconnectAttempts(0);
            
            // Send login message with sessionId
            if (sessionId) {
                console.log('Sending login message', { sessionId });
                ws.send(JSON.stringify({ type: 'login', userId: sessionId }));
            } else {
                console.warn('No sessionId found in localStorage!');
            }
            
            // Request the track list when the connection opens
            console.log('Requesting tracks list');
            ws.send(JSON.stringify({ type: 'get_tracks' }));
            
            // Request the session list when the connection opens
            console.log('Requesting sessions list');
            ws.send(JSON.stringify({ type: 'get_sessions' }));
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('=== WEBSOCKET MESSAGE RECEIVED ===', { type: data.type });
                
                switch (data.type) {
                    case 'login_success':
                        console.log('Login successful!', data);
                        break;
                    case 'tracks_list':
                        console.log('Tracks list received', { count: data.tracks?.length });
                        setTracks(data.tracks);
                        break;
                    case 'mode':
                        console.log('Mode update received', {
                            mode: data.mode,
                            hasCurrentTrack: !!data.currentlyPlayingTrack,
                            masterUserSessionId: data.masterUserSessionId,
                            canTakeMasterControl: data.canTakeMasterControl,
                        });
                        setMode(data.mode);
                        setCurrentlyPlayingTrack(data.currentlyPlayingTrack || null);
                        setMasterUserSessionId(data.masterUserSessionId || null);
                        setCanTakeMasterControl(data.canTakeMasterControl || false);
                        setFallbackInfo(data.fallbackPlaylist || null);
                        break;
                    case 'session_mode':
                        console.log('Session mode received', { sessionMode: data.sessionMode });
                        setSessionMode(data.sessionMode);
                        break;
                    case 'sessions_list':
                        console.log('Sessions list received', { count: data.sessions?.length });
                        setConnectedSessions(data.sessions || []);
                        break;
                    case 'play_airhorn':
                        console.log('Airhorn play command received', { airhorn: data.airhorn });
                        if (data.airhorn) {
                            const audio = new window.Audio(`/airhorns/${data.airhorn}.mp3`);
                            audio.play();
                        }
                        break;
                    case 'history':
                        console.log('History received', { count: data.history?.length });
                        setHistory(Array.isArray(data.history) ? data.history : []);
                        break;
                    case 'play_history':
                        console.log('Play history received', { count: data.playHistory?.length });
                        setPlayHistory(Array.isArray(data.playHistory) ? data.playHistory : []);
                        break;
                    case 'login_error':
                        console.error('Login error received', data);
                        // If listener info is available, auto-relogin
                        const listenerName = localStorage.getItem('listener_name');
                        const listenerEmail = localStorage.getItem('listener_email');
                        if (listenerName && listenerEmail) {
                            fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/listener-login`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name: listenerName, email: listenerEmail })
                            })
                                .then(res => res.json())
                                .then(data => {
                                    if (data.sessionId) {
                                        localStorage.setItem('sessionId', data.sessionId);
                                        // Reconnect WebSocket with new sessionId
                                        if (wsRef.current) wsRef.current.close();
                                        setTimeout(() => connectWebSocket(), 100);
                                    } else {
                                        router.push('/login');
                                    }
                                })
                                .catch(() => {
                                    router.push('/login');
                                });
                        } else {
                            router.push('/login');
                        }
                        break;
                    default:
                        console.log('Unknown message type received:', data.type);
                }
            } catch (error) {
                console.error('Error processing WebSocket message:', error);
            }
        };

        ws.onclose = (event) => {
            console.log('=== WEBSOCKET CLOSED ===', {
                code: event.code,
                reason: event.reason,
                wasClean: event.wasClean,
                reconnectAttempts,
            });
            setConnected(false);
            
            // Auto-reconnect with exponential backoff (max 10s)
            const nextDelay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
            console.log(`Will reconnect in ${nextDelay}ms`);
            setReconnectAttempts((prev) => prev + 1);
            
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = setTimeout(() => {
                console.log('Attempting reconnect...');
                connectWebSocket();
            }, nextDelay);
        };

        ws.onerror = (error) => {
            console.error('=== WEBSOCKET ERROR ===', error);
        };
    }, [reconnectAttempts]);

    // Heartbeat / ping interval
    useEffect(() => {
        if (!connected || !sessionId) return;
        
        console.log('Starting heartbeat interval');
        const heartbeatInterval = setInterval(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                console.log('Sending ping to keep session alive');
                wsRef.current.send(JSON.stringify({ type: 'ping', sessionId }));
            }
        }, 30000); // Ping every 30 seconds
        
        return () => {
            console.log('Stopping heartbeat interval');
            clearInterval(heartbeatInterval);
        };
    }, [connected, sessionId]);

    useEffect(() => {
        console.log('=== MAIN PAGE MOUNTED ===');
        
        // Check if user is logged in
        const storedSessionId = localStorage.getItem('sessionId');
        console.log('Checking session...', { 
            hasSessionId: !!storedSessionId,
            sessionId: storedSessionId,
        });
        
        if (!storedSessionId) {
            console.warn('No sessionId found, redirecting to login');
            router.push('/login');
            return;
        }
        
        setSessionId(storedSessionId); // Update state
        
        console.log('Verifying session with backend...');
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/session/${storedSessionId}`)
            .then(res => res.json())
            .then(data => {
                console.log('Session verification response:', data);
                if (!data || !data.loggedIn) {
                    console.warn('Session not valid, redirecting to login');
                    router.push('/login');
                } else {
                    console.log('Session valid!');
                }
            })
            .catch((error) => {
                console.error('Session verification failed:', error);
                router.push('/login');
            });
            
        console.log('Initiating WebSocket connection...');
        connectWebSocket();
        
        return () => {
            console.log('=== MAIN PAGE UNMOUNTING ===');
            if (wsRef.current) {
                console.log('Closing WebSocket on unmount');
                wsRef.current.close();
            }
            if (reconnectTimeoutRef.current) {
                console.log('Clearing reconnect timeout');
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, []); // Only run once on mount

    // Listen for prominent_message WebSocket events
    useEffect(() => {
        if (!wsRef.current) return;
        const ws = wsRef.current;
        const handler = (event: MessageEvent) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'prominent_message' && msg.message) {
                    setProminentToast(msg.message);
                    setTimeout(() => setProminentToast(null), 8000);
                }
            } catch {}
        };
        ws.addEventListener('message', handler);
        return () => ws.removeEventListener('message', handler);
    }, []);

    const submitTrack = async () => {
        if (!trackId.trim()) return;
        const sessionId = localStorage.getItem('sessionId');
        if (!sessionId) {
            alert('No session ID found. Please log in again.');
            router.push('/login');
            return;
        }
        // Check for duplicate track on the client side
        if (tracks.some(t => t.spotifyUri === trackId)) {
            setToast('That track is already in the Play Queue.');
            return;
        }
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tracks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'spotify-access-token': localStorage.getItem('spotify_access_token') || '',
                },
                body: JSON.stringify({ trackId, sessionId }),
            });
            if (res.ok) {
                const data = await res.json();
                // If backend also returns duplicate (in case of race), show toast
                if (data && data.success && tracks.some(t => t.spotifyUri === trackId)) {
                    setToast('That track is already in the Play Queue.');
                }
            }
        } catch (error) {
            alert('Failed to submit track');
        } finally {
            setTrackId('');
        }
    };

    // Common WebSocket send handler
    const handleWsSend = (obj: any) => {
        if (wsRef.current) {
            wsRef.current.send(JSON.stringify(obj));
        }
    };

    // Master Play and Pause controls
    const handlePlay = () => handleWsSend({ type: 'master_play' });
    const handlePause = () => handleWsSend({ type: 'master_pause' });
    const isMaster = sessionId && masterUserSessionId && sessionId === masterUserSessionId;
    const handleTakeMasterControl = () => sessionId && handleWsSend({ type: 'take_master_control', sessionId });
    // Session Play and Pause controls
    const handleSessionPlay = () => sessionId && handleWsSend({ type: 'session_play', sessionId });
    const handleSessionPause = () => sessionId && handleWsSend({ type: 'session_pause', sessionId });

    // Send a 'jam' message via WebSocket
    const handleJam = (track: any) => {
        if (sessionId) {
            handleWsSend({ type: 'jam', spotifyUri: track.spotifyUri, sessionId });
        }
    };

    // Send a 'remove_track' message via WebSocket
    const handleRemoveTrack = (track: any) => {
        if (sessionId) {
            handleWsSend({ type: 'remove_track', spotifyUri: track.spotifyUri, sessionId });
        }
    };

    // Master-only: Load random liked tracks
    const handleLoadRandomLiked = async () => {
        setLoadingRandomLiked(true);
        try {
            const sessionId = localStorage.getItem('sessionId');
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/master-random-liked`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setToast(`Loaded ${data.added || 0} random liked tracks!`);
            } else {
                setToast(data.error || 'Failed to load liked tracks.');
            }
        } catch (err) {
            setToast('Failed to load liked tracks.');
        } finally {
            setLoadingRandomLiked(false);
        }
    };

    // Send airhorn command
    const handleSendAirhorn = (airhorn: string) => {
        if (wsRef.current) {
            wsRef.current.send(JSON.stringify({ type: 'airhorn', airhorn }));
        }
    };

    // Fetch play history on tab switch
    useEffect(() => {
        if (sidebarTab === 2 && wsRef.current) {
            wsRef.current.send(JSON.stringify({ type: 'get_play_history' }));
        }
    }, [sidebarTab]);

    // Listen for play_history messages
    useEffect(() => {
        if (!wsRef.current) return;
        const ws = wsRef.current;
        const handler = (event: MessageEvent) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'play_history') {
                    setPlayHistory(msg.playHistory || []);
                }
            } catch {}
        };
        ws.addEventListener('message', handler);
        return () => ws.removeEventListener('message', handler);
    }, []);

    // Add the handleMasterSkip function:
    const handleMasterSkip = () => {
        if (isMaster && sessionId && wsRef.current) {
            wsRef.current.send(JSON.stringify({ type: 'master_skip', sessionId }));
        }
    };

    // ProminentToast component
    function ProminentToast({ message, onClose }: { message: string, onClose: () => void }) {
        useEffect(() => {
            const timer = setTimeout(onClose, 8000);
            return () => clearTimeout(timer);
        }, [onClose]);
        return (
            <div className="fixed top-2 left-1/2 transform -translate-x-1/2 z-[100] bg-red-600 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 border-2 border-red-800 animate-fade-in font-bold text-lg">
                <span className="text-2xl">⚠️</span>
                <span>{message}</span>
                <button className="ml-4 text-white text-xl font-bold" onClick={onClose}>&times;</button>
            </div>
        );
    }

    // Get the current user's email
    const userEmail = (() => {
        const session = connectedSessions.find(s => s.sessionId === sessionId);
        // If this is the current user and they are a listener, use localStorage values
        if (session && session.sessionId === sessionId) {
            // Heuristic: if name or email is missing or 'Unknown'/'No email', use localStorage
            if ((session.name === 'Unknown' || !session.name) && typeof window !== 'undefined') {
                return localStorage.getItem('listener_email');
            }
            if ((session.email === 'No email' || !session.email) && typeof window !== 'undefined') {
                return localStorage.getItem('listener_email');
            }
            return session.email;
        }
        // Fallback: use localStorage
        return (typeof window !== 'undefined' ? localStorage.getItem('listener_email') : null);
    })();

    // Fix for hasJammed:
    const hasJammed = currentlyPlayingTrack && Array.isArray(currentlyPlayingTrack.jammers) && userEmail && currentlyPlayingTrack.jammers.includes(userEmail);

    return (
        <div className="min-h-screen bg-gray-100 flex">
            {/* Main Content */}
            <div className="flex-1">
                {toast && <Toast message={toast} onClose={closeToast} />}
                {prominentToast && <ProminentToast message={prominentToast} onClose={closeProminentToast} />}
                <div className="bg-white rounded-lg shadow p-3">
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                            <img src="/Andre2.png" alt="Andre Too" className="h-8 w-8 rounded" />
                            <h1 className="text-lg font-bold">Andre Too</h1>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center gap-2 mb-0.5">
                                <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
                                <span className="text-xs">{connected ? 'Connected' : 'Disconnected'}</span>
                            </div>
                        </div>
                    </div>

                    {fallbackInfo && (
                        <div className="text-xs text-gray-600 mb-2">
                            <span className="font-semibold">Fallback:</span>{' '}
                            <a
                                href={fallbackInfo.url && fallbackInfo.url.startsWith('spotify:playlist:') ? `https://open.spotify.com/playlist/${fallbackInfo.url.split(':')[2]}` : (fallbackInfo.url || '#')}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 underline"
                                title="Open fallback playlist"
                            >
                                {fallbackInfo.name}
                            </a>{' '}
                            <span className="text-gray-400">({fallbackInfo.trackCount})</span>
                        </div>
                    )}

                    {/* Master-only controls region */}
                    {isMaster && (
                        <div className="mb-6 p-3 bg-blue-50 border border-blue-100 rounded flex items-center gap-3 text-sm">
                            <span className="font-semibold text-blue-700">Master Controls:</span>
                            <button
                                onClick={handleLoadRandomLiked}
                                className="px-2 py-1 bg-blue-200 text-blue-800 rounded hover:bg-blue-300 disabled:opacity-50 text-xs font-medium"
                                disabled={loadingRandomLiked}
                            >
                                {loadingRandomLiked ? 'Loading...' : 'Load 10 Random Liked Tracks'}
                            </button>
                            <span className="ml-4 text-gray-500">Playback:</span>
                            <button
                                className="ml-1 px-2 py-1 rounded bg-green-100 text-green-800 hover:bg-green-200 disabled:opacity-50 text-xs font-medium border border-green-200"
                                onClick={handlePlay}
                                disabled={mode === 'master_play'}
                                title="Master Play"
                            >
                                ▶️
                            </button>
                            <button
                                className="ml-1 px-2 py-1 rounded bg-yellow-100 text-yellow-800 hover:bg-yellow-200 disabled:opacity-50 text-xs font-medium border border-yellow-200"
                                onClick={handlePause}
                                disabled={mode === 'master_pause'}
                                title="Master Pause"
                            >
                                ⏸️
                            </button>
                            <button
                                className="ml-1 px-2 py-1 rounded bg-red-100 text-red-800 hover:bg-red-200 disabled:opacity-50 text-xs font-medium border border-red-200"
                                onClick={handleMasterSkip}
                                disabled={!currentlyPlayingTrack || (!(tracks.length > 0 || !!fallbackInfo))}
                                title="Skip to Next Track"
                            >
                                ⏭️ Skip
                            </button>
                            <span className="ml-2 text-xs text-gray-400">{mode === 'master_play' ? 'Playing' : 'Paused'}</span>
                        </div>
                    )}

                    {/* Backdoor controls for authorized users who are not master */}
                    {!isMaster && canTakeMasterControl && (
                        <div className="mb-6 p-3 bg-orange-50 border border-orange-200 rounded flex items-center gap-3 text-sm">
                            <span className="font-semibold text-orange-700">Playback Controls:</span>
                            <button
                                className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 text-xs font-bold"
                                onClick={handleTakeMasterControl}
                                title="Take control of master playback"
                            >
                                👑 Take Master Control
                            </button>
                            <span className="ml-2 text-xs text-gray-500">
                                You have permission to take control
                            </span>
                        </div>
                    )}

                    {/* Currently Playing Track Section */}
                    {currentlyPlayingTrack && (
                        <div className="flex items-start gap-4 mb-4 p-3 bg-gradient-to-r from-blue-100 to-blue-200 rounded-lg shadow-lg relative min-h-[120px]">
                            {currentlyPlayingTrack.albumArtUrl ? (
                                <img
                                    src={currentlyPlayingTrack.albumArtUrl}
                                    alt={currentlyPlayingTrack.album}
                                    className="w-28 h-28 object-cover rounded-lg shadow"
                                />
                            ) : (
                                <div className="w-28 h-28 bg-gray-300 rounded-lg shadow flex items-center justify-center">
                                    <span className="text-gray-500 text-3xl">🎵</span>
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <div className="min-w-0">
                                        <div className="text-base font-bold mb-0.5 truncate">
                                            {currentlyPlayingTrack.name || currentlyPlayingTrack.spotifyUri || 'Unknown Track'}
                                        </div>
                                        {currentlyPlayingTrack.artist && (
                                            <div className="text-xs text-gray-700 mb-0.5 truncate">{currentlyPlayingTrack.artist}</div>
                                        )}
                                        {currentlyPlayingTrack.album && (
                                            <div className="text-xs text-gray-500 truncate">{currentlyPlayingTrack.album}</div>
                                        )}
                                        {currentlyPlayingTrack.spotifyName && (
                                            <div className="text-[10px] text-gray-400 mt-0.5 truncate">Submitted by: {currentlyPlayingTrack.spotifyName}</div>
                                        )}
                                    </div>
                                    <div className="flex gap-2 items-center absolute right-4 top-4">
                                        <button
                                            className={`text-xl px-2 py-2 rounded text-yellow-800 hover:bg-yellow-100`}
                                            title="Jam"
                                            onClick={() => handleJam(currentlyPlayingTrack)}
                                        >
                                            {hasJammed ? '👎' : '👍'}
                                        </button>
                                        <button
                                            className="text-xl px-2 py-2 rounded hover:bg-yellow-100"
                                            title="Airhorn"
                                            onClick={() => setAirhornModalOpen(true)}
                                        >
                                            📯
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-xs text-gray-600 flex items-center gap-1">
                                        Jams: <JamCount count={Array.isArray(currentlyPlayingTrack.jammers) ? currentlyPlayingTrack.jammers.length : 0} />
                                    </span>
                                </div>
                                {/* Progress bar at the bottom */}
                                {currentlyPlayingTrack.progress && currentlyPlayingTrack.progress.duration_ms > 0 && (
                                    <div className="mt-3">
                                        <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                                            <span>Progress</span>
                                            <span>
                                                {Math.floor((currentlyPlayingTrack.progress.position_ms || 0) / 60000)}:{((currentlyPlayingTrack.progress.position_ms || 0) % 60000 / 1000).toFixed(0).padStart(2, '0')} /
                                                {Math.floor((currentlyPlayingTrack.progress.duration_ms || 0) / 60000)}:{((currentlyPlayingTrack.progress.duration_ms || 0) % 60000 / 1000).toFixed(0).padStart(2, '0')}
                                            </span>
                                        </div>
                                        <div className="w-full h-1 bg-gray-200 rounded">
                                            <div
                                                className="h-1 bg-blue-500 rounded"
                                                style={{ width: `${(currentlyPlayingTrack.progress.position_ms / currentlyPlayingTrack.progress.duration_ms) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Distinct area for submit track and track table, now fills vertical space */}
                    <div className="bg-white rounded-lg shadow border border-gray-200 p-3 mb-6 flex flex-col h-full min-h-0" style={{height: 'calc(100vh - 64px)'}}>
                        {/* Add Track Section (compact, no extra margin) */}
                        <div className="flex items-center gap-2">
                        <input
                            type="text"
                                placeholder="Enter Spotify Track URI"
                            value={trackId}
                            onChange={e => setTrackId(e.target.value)}
                                className="border rounded px-2 py-1 w-2/3 text-xs"
                        />
                        <button
                            onClick={submitTrack}
                                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs"
                        >
                            Submit Track
                        </button>
                    </div>
                        <div className="bg-gray-50 rounded p-2 flex-1 min-h-0 overflow-y-auto mt-2">
                            {tracks.length === 0 ? (
                                <div className="text-gray-500">No tracks submitted yet.</div>
                            ) : (
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr>
                                            <th className="w-12 p-1">Art</th>
                                            <th className="p-1">Track</th>
                                            <th className="w-24 p-1">Submitted By</th>
                                            <th className="w-12 p-1">Jams</th>
                                            <th className="w-16 p-1"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tracks.map((track, index) => {
                                            // Determine if the current user has jammed the track
                                            const hasJammedRow = Array.isArray(track.jammers) && userEmail && track.jammers.includes(userEmail);
                                            return (
                                                <tr key={index} className="border-b last:border-b-0">
                                                    <td className="py-1 align-middle p-1">
                                                        {track.albumArtUrl ? (
                                                            <img
                                                                src={track.albumArtUrl}
                                                                alt={track.album}
                                                                className="w-10 h-10 object-cover rounded"
                                                                title={track.album || ''}
                                                            />
                                                        ) : null}
                                                    </td>
                                                    <td className="py-1 align-middle p-1">
                                                        <div className="font-semibold text-xs truncate">
                                                            {track.name || track.spotifyUri}
                                                        </div>
                                                        {track.artist && (
                                                            <div className="text-[10px] text-gray-500 mt-0.5 truncate">
                                                                {track.artist}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-1 align-middle p-1">
                                                        {track.spotifyName && (
                                                            <span className={`text-[10px] truncate ${track.isFallback ? 'text-blue-600 italic' : 'text-gray-700'}`}>
                                                                {track.spotifyName}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-1 align-middle p-1">
                                                        <JamCount count={Array.isArray(track.jammers) ? track.jammers.length : 0} />
                                                    </td>
                                                    <td className="py-1 align-middle p-1">
                                                        <div className="flex flex-row gap-1 items-center">
                                                            <button
                                                                className={`text-base px-1 py-1 rounded text-yellow-800 hover:bg-yellow-100`}
                                                                title="Jam"
                                                                aria-label="Thumbs Up"
                                                                type="button"
                                                                onClick={() => handleJam(track)}
                                                            >
                                                                {hasJammedRow ? '👎' : '👍'}
                                                            </button>
                                                            {!track.isFallback && (
                                                                <button
                                                                    className="text-base px-1 py-1 rounded hover:bg-gray-200 disabled:opacity-50"
                                                                    title="Delay"
                                                                    aria-label="Down Arrow"
                                                                    type="button"
                                                                    disabled={track.userEmail !== userEmail}
                                                                    onClick={() => sessionId && handleWsSend({ type: 'delay_track', spotifyUri: track.spotifyUri, sessionId })}
                                                                >
                                                                    ⬇️
                                                                </button>
                                                            )}
                                                            {!track.isFallback && (
                                                                <button
                                                                    className="text-base px-1 py-1 rounded hover:bg-red-200 text-red-600"
                                                                    title="Remove Track"
                                                                    aria-label="Remove Track"
                                                                    type="button"
                                                                    onClick={() => handleRemoveTrack(track)}
                                                                >
                                                                    🗑️
                                                                </button>
                                                            )}
                                    </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {/* Sidebar - now with three tabs */}
            <div className="w-80 bg-white shadow-lg p-3 overflow-y-auto">
                {/* Tab bar at the top */}
                <div className="flex-1 mb-2">
                    <div className="flex border-b border-gray-200">
                        <button
                            className={`flex-1 text-xs py-2 px-0 text-center font-medium focus:outline-none transition-all
                                ${sidebarTab === 0
                                    ? 'border-b-2 border-blue-500 text-blue-600 bg-white'
                                    : 'text-gray-500 hover:text-blue-600 bg-gray-50'}
                            `}
                            style={{ borderTopLeftRadius: '0.5rem' }}
                            onClick={() => setSidebarTab(0)}
                        >History</button>
                        <button
                            className={`flex-1 text-xs py-2 px-0 text-center font-medium focus:outline-none transition-all
                                ${sidebarTab === 1
                                    ? 'border-b-2 border-blue-500 text-blue-600 bg-white'
                                    : 'text-gray-500 hover:text-blue-600 bg-gray-50'}
                            `}
                            onClick={() => setSidebarTab(1)}
                        >Users</button>
                        <button
                            className={`flex-1 text-xs py-2 px-0 text-center font-medium focus:outline-none transition-all
                                ${sidebarTab === 2
                                    ? 'border-b-2 border-blue-500 text-blue-600 bg-white'
                                    : 'text-gray-500 hover:text-blue-600 bg-gray-50'}
                            `}
                            style={{ borderTopRightRadius: '0.5rem' }}
                            onClick={() => setSidebarTab(2)}
                        >Plays</button>
                    </div>
                </div>
                {/* Title below tab bar */}
                <h2 className="text-lg font-bold text-gray-800 mb-2">
                    {sidebarTab === 0 ? 'Event History' : sidebarTab === 1 ? 'Connected Users' : 'Play History'}
                </h2>
                {/* Sidebar content below */}
                {sidebarTab === 0 ? (
                    <div className="space-y-2">
                        {/* Message input */}
                        <form className="flex gap-2" onSubmit={(e) => {
                            e.preventDefault();
                            const input = e.currentTarget.elements.namedItem('message') as HTMLInputElement;
                            const message = input.value.trim();
                            if (message && sessionId) {
                                handleWsSend({ type: 'history_message', message, sessionId });
                                input.value = '';
                            }
                        }}>
                            <input
                                type="text"
                                name="message"
                                placeholder="Post a message..."
                                className="flex-1 px-2 py-1 border rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                                maxLength={200}
                            />
                            <button
                                type="submit"
                                className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                            >
                                Post
                            </button>
                        </form>
                        {history.length === 0 ? (
                            <div className="text-gray-500 text-xs">No events yet</div>
                        ) : (
                            <ul className="space-y-2">
                                {history.slice().reverse().map((event, idx) => {
                                    // Helper to format time ago
                                    const getTimeAgo = (timestamp: number) => {
                                        const seconds = Math.floor((Date.now() - timestamp) / 1000);
                                        if (seconds < 60) return `${seconds}s ago`;
                                        const minutes = Math.floor(seconds / 60);
                                        if (minutes < 60) return `${minutes}m ago`;
                                        const hours = Math.floor(minutes / 60);
                                        if (hours < 24) return `${hours}h ago`;
                                        return new Date(timestamp).toLocaleDateString();
                                    };

                                    return (
                                        <li key={idx} className={`p-2 rounded-lg border shadow-sm ${
                                            event.type === 'message' ? 'bg-blue-50 border-blue-200' : 
                                            event.type === 'track_play' ? 'bg-green-50 border-green-200' :
                                            event.type === 'track_skip' ? 'bg-orange-50 border-orange-200' :
                                            'bg-gray-50 border-gray-200'
                                        }`}>
                                            {/* Timestamp */}
                                            <div className="text-[10px] text-gray-500 mb-1.5">
                                                {getTimeAgo(event.timestamp)}
                                            </div>
                                            
                                            {/* Message events */}
                                            {event.type === 'message' && (
                                                <>
                                                    <div className="flex items-center gap-1 mb-1">
                                                        <span className="text-lg">💬</span>
                                                        <div className="font-semibold text-xs text-gray-800 truncate">
                                                            {event.userName}
                                                        </div>
                                                    </div>
                                                    <div className="text-sm text-gray-900 ml-6">{event.details.message}</div>
                                                </>
                                            )}
                                            
                                            {/* Session events */}
                                            {(event.type === 'user_connected' || event.type === 'user_disconnected') && (
                                                <div className="flex items-center gap-2">
                                                    {event.type === 'user_connected' ? (
                                                        event.details?.loginType === 'spotify' ? (
                                                            <img src="/256px-Spotify_icon.svg.png" alt="Spotify" className="w-5 h-5" />
                                                        ) : (
                                                            <span className="text-lg">🟢</span>
                                                        )
                                                    ) : (
                                                        <span className="text-lg">🔴</span>
                                                    )}
                                                    <div className="text-xs">
                                                        <span className="font-semibold">{event.userName}</span>
                                                        <span className="text-gray-600 ml-1">
                                                            {event.type === 'user_connected' ? (
                                                                <>
                                                                    joined{' '}
                                                                    <span className="text-gray-500 italic">
                                                                        {event.details?.loginType === 'spotify' ? 'via Spotify' : 'as Offline Contributor'}
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                'left'
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* Track play events */}
                                            {event.type === 'track_play' && (
                                                <div className="flex items-start gap-2">
                                                    <span className="text-lg mt-0.5">▶️</span>
                                                    {event.details?.track ? (
                                                        <>
                                                            {event.details.track.albumArtUrl && (
                                                                <img src={event.details.track.albumArtUrl} alt={event.details.track.album || ''} className="w-12 h-12 object-cover rounded shadow-sm" />
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-semibold text-xs truncate text-gray-900">{event.details.track.name || event.details.track.spotifyUri || 'Unknown Track'}</div>
                                                                <div className="text-[10px] text-gray-600 truncate">{event.details.track.artist || 'Unknown Artist'}</div>
                                                                {event.details.track.album && (
                                                                    <div className="text-[10px] text-gray-500 truncate italic">{event.details.track.album}</div>
                                                                )}
                                                                <div className="text-[10px] text-gray-500 mt-0.5">
                                                                    <span className="font-medium">Started by:</span> {event.userName}
                                                                </div>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-semibold text-xs text-orange-600">🐛 Track Play Event (Missing Track Data)</div>
                                                            <div className="text-[10px] text-gray-600">
                                                                Started by: {event.userName}
                                                            </div>
                                                            <div className="text-[10px] text-gray-400 mt-0.5">
                                                                Debug: event.details = {JSON.stringify(event.details)}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            
                                            {/* Track skip events */}
                                            {event.type === 'track_skip' && (
                                                <div className="flex items-start gap-2">
                                                    <span className="text-lg mt-0.5">⏭️</span>
                                                    {event.details?.track ? (
                                                        <>
                                                            {event.details.track.albumArtUrl && (
                                                                <img src={event.details.track.albumArtUrl} alt={event.details.track.album || ''} className="w-12 h-12 object-cover rounded shadow-sm" />
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-semibold text-xs truncate text-gray-900">{event.details.track.name || event.details.track.spotifyUri || 'Unknown Track'}</div>
                                                                <div className="text-[10px] text-gray-600 truncate">{event.details.track.artist || 'Unknown Artist'}</div>
                                                                {event.details.track.album && (
                                                                    <div className="text-[10px] text-gray-500 truncate italic">{event.details.track.album}</div>
                                                                )}
                                                                <div className="text-[10px] text-gray-500 mt-0.5">
                                                                    <span className="font-medium">Skipped by:</span> {event.userName}
                                                                </div>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-semibold text-xs text-orange-600">🐛 Track Skip Event (Missing Track Data)</div>
                                                            <div className="text-[10px] text-gray-600">
                                                                Skipped by: {event.userName}
                                                            </div>
                                                            <div className="text-[10px] text-gray-400 mt-0.5">
                                                                Debug: event.details = {JSON.stringify(event.details)}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            
                                            {/* Track added events */}
                                            {event.type === 'track_added' && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg">➕</span>
                                                    <div>
                                                        <div className="font-semibold text-xs text-gray-800 truncate">
                                                            {event.userName}
                                                        </div>
                                                        <div className="text-xs mt-0.5 text-gray-600">added <span className="font-bold">{event.details.track}</span></div>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* Jam events */}
                                            {event.type === 'jam' && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg">🔥</span>
                                                    <div>
                                                        <div className="font-semibold text-xs text-gray-800 truncate">
                                                            {event.userName}
                                                        </div>
                                                        <div className="text-xs mt-0.5 text-gray-600">jammed <span className="font-bold">{event.details.track}</span></div>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* Unjam events */}
                                            {event.type === 'unjam' && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg">❄️</span>
                                                    <div>
                                                        <div className="font-semibold text-xs text-gray-800 truncate">
                                                            {event.userName}
                                                        </div>
                                                        <div className="text-xs mt-0.5 text-gray-600">unjammed <span className="font-bold">{event.details.track}</span></div>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* Airhorn events */}
                                            {event.type === 'airhorn' && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg">📯</span>
                                                    <div>
                                                        <div className="font-semibold text-xs text-gray-800 truncate">
                                                            {event.userName}
                                                        </div>
                                                        <div className="text-xs mt-0.5 text-gray-600">played <span className="font-bold">{event.details.airhorn.replace(/-/g, ' ').replace(/_/g, ' ')}</span></div>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* Unknown/unhandled event types */}
                                            {!['message', 'user_connected', 'user_disconnected', 'track_play', 'track_skip', 'track_added', 'jam', 'unjam', 'airhorn'].includes(event.type) && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg">❓</span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-semibold text-xs text-purple-600">🐛 Unknown Event Type: {event.type}</div>
                                                        <div className="text-[10px] text-gray-400 mt-0.5">
                                                            Debug: {JSON.stringify(event)}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                ) : sidebarTab === 1 ? (
                    <div className="space-y-1">
                        {connectedSessions.length === 0 ? (
                            <div className="text-gray-500 text-xs">No users connected</div>
                        ) : (
                            connectedSessions.map((session) => {
                                const isCurrentUser = session.sessionId === sessionId;
                                let displayName = session.name;
                                let displayEmail = session.email;
                                // If this is the current user and they are a listener, use localStorage values
                                if (isCurrentUser && displayName === 'Unknown' && typeof window !== 'undefined') {
                                    displayName = localStorage.getItem('listener_name') || displayName;
                                    displayEmail = localStorage.getItem('listener_email') || displayEmail;
                                }
                                return (
                                    <div
                                        key={session.sessionId}
                                        className={`p-2 rounded border ${session.isMaster ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}${isCurrentUser ? ' ring-2 ring-blue-400' : ''}`}
                                    >
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className="font-semibold text-xs text-gray-800 truncate">
                                                {displayName}
                                                {session.isMaster && (
                                                    <span className="ml-1 text-blue-600 text-[10px]">👑 Master</span>
                                                )}
                                                {isCurrentUser && <span className="ml-1 text-green-600 text-[10px]">(You)</span>}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-gray-500 truncate">
                                            {displayEmail}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {playHistory.length === 0 ? (
                            <div className="text-gray-500 text-xs">No tracks played yet</div>
                        ) : (
                            <ul className="space-y-1">
                                {playHistory.slice().reverse().map((entry, idx) => (
                                    <li key={idx} className="flex items-center gap-2 p-2 rounded border bg-gray-50 border-gray-200">
                                        {entry.track.albumArtUrl ? (
                                            <img src={entry.track.albumArtUrl} alt={entry.track.album || ''} className="w-8 h-8 object-cover rounded" />
                                        ) : (
                                            <div className="w-8 h-8 bg-gray-300 rounded flex items-center justify-center text-lg">🎵</div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-xs truncate">{entry.track.name || entry.track.spotifyUri}</div>
                                            <div className="text-[10px] text-gray-500 truncate">{entry.track.artist}</div>
                                            <div className="text-[10px] text-gray-400 truncate">
                                                Played by: {entry.startedBy || 'Unknown'}
                                                <span className="ml-2">{new Date(entry.timestamp).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>
            <AirhornModal open={airhornModalOpen} onClose={() => setAirhornModalOpen(false)} onSelect={handleSendAirhorn} />
        </div>
    );
} 