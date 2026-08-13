/**
 * AppLayout — persistent application shell.
 *
 * Renders: Sidebar | (Header + <main> content outlet)
 * Preserves existing WebSocket implementation.
 */

import { Outlet } from 'react-router-dom';
import FigmaSidebar from '../components/FigmaSidebar';
import FigmaHeader from '../components/FigmaHeader';
import { useWebSocket } from '../hooks/useWebSocket';

export default function AppLayout() {
  const { readyState } = useWebSocket('/ws/alerts');

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg, #090d16)' }}>
      <FigmaSidebar wsStatus={readyState === 'open' ? 'connected' : readyState === 'connecting' ? 'connecting' : 'disconnected'} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <FigmaHeader systemHealthy={readyState === 'open'} />

        <main className="flex-1 overflow-y-auto p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
