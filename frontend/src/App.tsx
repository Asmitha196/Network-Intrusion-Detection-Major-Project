import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import ThreatIntelPage from './pages/ThreatIntelPage'
import IncidentResponsePage from './pages/IncidentResponsePage'
import SimulationPage from './pages/SimulationPage'
import ModelEvaluationPage from './pages/ModelEvaluationPage'
import AnalyticsPage from './pages/AnalyticsPage'
import ReportsPage from './pages/ReportsPage'
import AlertsPage from './pages/AlertsPage'
import TrafficPage from './pages/TrafficPage'
import ReplayPage from './pages/ReplayPage'
import MetricsPage from './pages/MetricsPage'
import SettingsPage from './pages/SettingsPage'
import { useWebSocket } from './hooks/useWebSocket'
import type { WebSocketMessage } from './types'

export default function App() {
  const { readyState } = useWebSocket<WebSocketMessage>('/ws/alerts')

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#090d16' }}>
        <Sidebar wsReadyState={readyState} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Navbar activePage="Enterprise Security Operations Center (SOC)" />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/threat-intel" element={<ThreatIntelPage />} />
            <Route path="/incident" element={<IncidentResponsePage />} />
            <Route path="/simulation" element={<SimulationPage />} />
            <Route path="/evaluation" element={<ModelEvaluationPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/traffic" element={<TrafficPage />} />
            <Route path="/replay" element={<ReplayPage />} />
            <Route path="/metrics" element={<MetricsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}
