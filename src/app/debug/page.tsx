'use client';

import { useState } from 'react';

interface LogEntry {
    timestamp: string;
    level: 'info' | 'success' | 'error';
    message: string;
    data?: any;
}

export default function DebugPage() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [healthData, setHealthData] = useState<any>(null);
    const [connectionData, setConnectionData] = useState<any>(null);
    const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
    const [loading, setLoading] = useState<Record<string, boolean>>({});

    const addLog = (level: 'info' | 'success' | 'error', message: string, data?: any) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level.toUpperCase()}]`, message, data || '');
        setLogs(prev => [...prev, { timestamp, level, message, data }]);
    };

    const testHealthCheck = async () => {
        setLoading(prev => ({ ...prev, health: true }));
        addLog('info', 'Testing health check endpoint...');
        
        try {
            const url = `${process.env.NEXT_PUBLIC_API_URL}/api/debug/health`;
            addLog('info', `Fetching: ${url}`);
            
            const startTime = Date.now();
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            const duration = Date.now() - startTime;
            
            addLog('info', `Response received in ${duration}ms`, {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
            });
            
            if (response.ok) {
                const data = await response.json();
                setHealthData(data);
                addLog('success', 'Health check successful!', data);
            } else {
                const text = await response.text();
                addLog('error', `Health check failed: ${response.status} ${response.statusText}`, { body: text });
            }
        } catch (error: any) {
            addLog('error', 'Health check error', {
                message: error.message,
                stack: error.stack,
            });
        } finally {
            setLoading(prev => ({ ...prev, health: false }));
        }
    };

    const testConnection = async () => {
        setLoading(prev => ({ ...prev, connection: true }));
        addLog('info', 'Testing connection endpoint...');
        
        try {
            const url = `${process.env.NEXT_PUBLIC_API_URL}/api/debug/connection`;
            addLog('info', `Posting to: ${url}`);
            
            const testData = {
                test: 'connection',
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                location: window.location.href,
            };
            
            const startTime = Date.now();
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(testData),
            });
            const duration = Date.now() - startTime;
            
            addLog('info', `Response received in ${duration}ms`, {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
            });
            
            if (response.ok) {
                const data = await response.json();
                setConnectionData(data);
                addLog('success', 'Connection test successful!', data);
            } else {
                const text = await response.text();
                addLog('error', `Connection test failed: ${response.status} ${response.statusText}`, { body: text });
            }
        } catch (error: any) {
            addLog('error', 'Connection test error', {
                message: error.message,
                stack: error.stack,
            });
        } finally {
            setLoading(prev => ({ ...prev, connection: false }));
        }
    };

    const testWebSocket = () => {
        addLog('info', 'Testing WebSocket connection...');
        setWsStatus('connecting');
        
        try {
            // Construct WebSocket URL from API URL
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            const wsUrl = apiUrl.replace(/^http/, 'ws') + '/websocket';
            addLog('info', `Connecting to WebSocket: ${wsUrl}`);
            
            const ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
                addLog('success', 'WebSocket connected!');
                setWsStatus('connected');
                
                // Send a test message
                const testMsg = { type: 'debug', message: 'Test message from debug page' };
                ws.send(JSON.stringify(testMsg));
                addLog('info', 'Sent test message', testMsg);
                
                // Close after 5 seconds
                setTimeout(() => {
                    ws.close();
                    addLog('info', 'WebSocket closed intentionally');
                    setWsStatus('disconnected');
                }, 5000);
            };
            
            ws.onerror = (error) => {
                addLog('error', 'WebSocket error', error);
                setWsStatus('error');
            };
            
            ws.onclose = (event) => {
                addLog('info', 'WebSocket closed', {
                    code: event.code,
                    reason: event.reason,
                    wasClean: event.wasClean,
                });
                setWsStatus('disconnected');
            };
            
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    addLog('success', 'WebSocket message received', data);
                } catch {
                    addLog('info', 'WebSocket message received (raw)', event.data);
                }
            };
        } catch (error: any) {
            addLog('error', 'WebSocket connection error', {
                message: error.message,
                stack: error.stack,
            });
            setWsStatus('error');
        }
    };

    const testSessionCheck = async () => {
        setLoading(prev => ({ ...prev, session: true }));
        addLog('info', 'Testing session check...');
        
        const sessionId = localStorage.getItem('sessionId');
        addLog('info', `Session ID from localStorage: ${sessionId || 'none'}`);
        
        if (!sessionId) {
            addLog('info', 'No session ID found in localStorage');
            setLoading(prev => ({ ...prev, session: false }));
            return;
        }
        
        try {
            const url = `${process.env.NEXT_PUBLIC_API_URL}/api/session/${sessionId}`;
            addLog('info', `Fetching: ${url}`);
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (response.ok) {
                addLog('success', 'Session check successful', data);
            } else {
                addLog('error', 'Session check failed', data);
            }
        } catch (error: any) {
            addLog('error', 'Session check error', {
                message: error.message,
                stack: error.stack,
            });
        } finally {
            setLoading(prev => ({ ...prev, session: false }));
        }
    };

    const testListenerLogin = async () => {
        setLoading(prev => ({ ...prev, listener: true }));
        addLog('info', 'Testing listener login...');
        
        const testEmail = `test-${Date.now()}@debug.com`;
        const testName = 'Debug Test User';
        
        try {
            const url = `${process.env.NEXT_PUBLIC_API_URL}/api/listener-login`;
            addLog('info', `Posting to: ${url}`, { name: testName, email: testEmail });
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: testName, email: testEmail }),
            });
            
            const data = await response.json();
            
            if (response.ok) {
                addLog('success', 'Listener login successful', data);
            } else {
                addLog('error', 'Listener login failed', data);
            }
        } catch (error: any) {
            addLog('error', 'Listener login error', {
                message: error.message,
                stack: error.stack,
            });
        } finally {
            setLoading(prev => ({ ...prev, listener: false }));
        }
    };

    const clearLogs = () => {
        setLogs([]);
        setHealthData(null);
        setConnectionData(null);
        addLog('info', 'Logs cleared');
    };

    const runAllTests = async () => {
        addLog('info', '========== RUNNING ALL TESTS ==========');
        await testHealthCheck();
        await new Promise(resolve => setTimeout(resolve, 500));
        await testConnection();
        await new Promise(resolve => setTimeout(resolve, 500));
        await testSessionCheck();
        await new Promise(resolve => setTimeout(resolve, 500));
        testWebSocket();
        await new Promise(resolve => setTimeout(resolve, 500));
        await testListenerLogin();
        addLog('info', '========== ALL TESTS COMPLETED ==========');
    };

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <h1 className="text-3xl font-bold mb-4">Connection Debug Page</h1>
                    
                    <div className="mb-4 p-4 bg-blue-50 rounded">
                        <h2 className="font-semibold mb-2">Environment:</h2>
                        <div className="text-sm space-y-1">
                            <p><strong>API URL:</strong> {process.env.NEXT_PUBLIC_API_URL || 'NOT SET'}</p>
                            <p><strong>WS URL:</strong> {(() => {
                                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
                                return apiUrl.replace(/^http/, 'ws') + '/websocket';
                            })()}</p>
                            <p><strong>WebSocket Status:</strong> <span className={`font-semibold ${
                                wsStatus === 'connected' ? 'text-green-600' :
                                wsStatus === 'connecting' ? 'text-yellow-600' :
                                wsStatus === 'error' ? 'text-red-600' :
                                'text-gray-600'
                            }`}>{wsStatus}</span></p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3 mb-6">
                        <button
                            onClick={runAllTests}
                            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 font-semibold"
                        >
                            Run All Tests
                        </button>
                        <button
                            onClick={testHealthCheck}
                            disabled={loading.health}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading.health ? 'Testing...' : 'Test Health Check'}
                        </button>
                        <button
                            onClick={testConnection}
                            disabled={loading.connection}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >
                            {loading.connection ? 'Testing...' : 'Test Connection'}
                        </button>
                        <button
                            onClick={testWebSocket}
                            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                        >
                            Test WebSocket
                        </button>
                        <button
                            onClick={testSessionCheck}
                            disabled={loading.session}
                            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {loading.session ? 'Testing...' : 'Test Session'}
                        </button>
                        <button
                            onClick={testListenerLogin}
                            disabled={loading.listener}
                            className="px-4 py-2 bg-pink-600 text-white rounded hover:bg-pink-700 disabled:opacity-50"
                        >
                            {loading.listener ? 'Testing...' : 'Test Listener Login'}
                        </button>
                        <button
                            onClick={clearLogs}
                            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                        >
                            Clear Logs
                        </button>
                    </div>
                </div>

                {/* Logs Section */}
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <h2 className="text-xl font-bold mb-4">Logs ({logs.length})</h2>
                    <div className="bg-black text-white p-4 rounded font-mono text-sm max-h-96 overflow-y-auto">
                        {logs.length === 0 ? (
                            <p className="text-gray-400">No logs yet. Run a test to see logs.</p>
                        ) : (
                            logs.map((log, idx) => (
                                <div key={idx} className={`mb-2 ${
                                    log.level === 'error' ? 'text-red-400' :
                                    log.level === 'success' ? 'text-green-400' :
                                    'text-white'
                                }`}>
                                    <span className="text-gray-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                    {' '}
                                    <span className="font-semibold">[{log.level.toUpperCase()}]</span>
                                    {' '}
                                    {log.message}
                                    {log.data && (
                                        <pre className="ml-4 mt-1 text-xs text-gray-300 overflow-x-auto">
                                            {JSON.stringify(log.data, null, 2)}
                                        </pre>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Health Data */}
                {healthData && (
                    <div className="bg-white rounded-lg shadow p-6 mb-6">
                        <h2 className="text-xl font-bold mb-4">Health Check Data</h2>
                        <pre className="bg-gray-100 p-4 rounded overflow-x-auto text-sm">
                            {JSON.stringify(healthData, null, 2)}
                        </pre>
                    </div>
                )}

                {/* Connection Data */}
                {connectionData && (
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-xl font-bold mb-4">Connection Test Data</h2>
                        <pre className="bg-gray-100 p-4 rounded overflow-x-auto text-sm">
                            {JSON.stringify(connectionData, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}

