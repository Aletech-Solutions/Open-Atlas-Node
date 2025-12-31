import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import api from '../utils/api';
import { X, AlertCircle } from 'lucide-react';

export default function Terminal({ machineId }) {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const [sessionId, setSessionId] = useState(null);
  const sessionIdRef = useRef(null); // Use ref for immediate access
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(true);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    initTerminal();
    return () => {
      cleanup();
    };
  }, [machineId]);

  async function initTerminal() {
    try {
      // Create terminal instance
      const term = new XTerm({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
          cursor: '#d4d4d4'
        },
        cols: 80,
        rows: 24
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      term.open(terminalRef.current);
      fitAddon.fit();

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      // Create SSH session first
      const response = await api.post(`/terminal/create/${machineId}`);
      const newSessionId = response.data.sessionId;
      setSessionId(newSessionId);
      sessionIdRef.current = newSessionId; // Store in ref for immediate access

      // Handle terminal input
      term.onData((data) => {
        if (sessionIdRef.current) {
          sendData(data);
        }
      });

      // Handle resize
      window.addEventListener('resize', () => {
        fitAddon.fit();
        if (sessionIdRef.current) {
          resizeTerminal(term.rows, term.cols);
        }
      });

      // Start reading output
      startReading(newSessionId);

      setConnecting(false);
      term.writeln('Terminal connected. Press Enter to start.\r\n');

    } catch (err) {
      console.error('Terminal init error:', err);
      setError(err.response?.data?.error || 'Failed to create terminal session');
      setConnecting(false);
    }
  }

  function startReading(sessionId) {
    const eventSource = new EventSource(`/api/terminal/read/${sessionId}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'connected') {
          console.log('Terminal SSE connected:', data.sessionId);
          return;
        }
        
        if (data.type === 'close') {
          xtermRef.current?.writeln('\r\n\r\nConnection closed.');
          eventSource.close();
          setError('Terminal session closed');
          return;
        }

        if (data.type === 'error') {
          xtermRef.current?.writeln(`\r\n\r\nError: ${data.message}`);
          eventSource.close();
          setError(data.message);
          return;
        }

        if (data.data) {
          const decodedData = atob(data.data);
          xtermRef.current?.write(decodedData);
        }
      } catch (err) {
        console.error('Terminal read error:', err);
      }
    };

    eventSource.onerror = (event) => {
      console.error('EventSource error:', event);
      const errorMsg = 'Connection lost. Please check if the machine is online and SSH credentials are correct.';
      setError(errorMsg);
      if (xtermRef.current) {
        xtermRef.current.writeln(`\r\n\r\n${errorMsg}`);
      }
      eventSource.close();
    };

    eventSource.onopen = () => {
      console.log('EventSource connection opened');
    };
  }

  async function sendData(data) {
    try {
      const currentSessionId = sessionIdRef.current || sessionId;
      if (!currentSessionId) {
        console.error('No session ID available for writing');
        return;
      }
      await api.post(`/terminal/write/${currentSessionId}`, { data });
    } catch (err) {
      console.error('Terminal write error:', err);
    }
  }

  async function resizeTerminal(rows, cols) {
    try {
      const currentSessionId = sessionIdRef.current || sessionId;
      if (!currentSessionId) {
        return;
      }
      await api.post(`/terminal/resize/${currentSessionId}`, { rows, cols });
    } catch (err) {
      console.error('Terminal resize error:', err);
    }
  }

  async function cleanup() {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const currentSessionId = sessionIdRef.current || sessionId;
    if (currentSessionId) {
      try {
        await api.delete(`/terminal/${currentSessionId}`);
      } catch (err) {
        console.error('Terminal cleanup error:', err);
      }
    }

    if (xtermRef.current) {
      xtermRef.current.dispose();
    }
    
    sessionIdRef.current = null;
  }

  if (error) {
    return (
      <div className="card">
        <div className="flex items-center space-x-3 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <span>Terminal Error: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
        <span className="text-white text-sm font-medium">SSH Terminal</span>
        {connecting && (
          <span className="text-gray-400 text-sm">Connecting...</span>
        )}
      </div>
      <div
        ref={terminalRef}
        className="bg-[#1e1e1e] p-2"
        style={{ height: '500px' }}
      />
    </div>
  );
}

