import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import Dashboard from './pages/Dashboard'
import { CorrelatedIncidentsPage } from './pages/CorrelatedIncidentsPage'
import { AttackerProfilesPage } from './pages/AttackerProfilesPage'
import HoneypotPage from './pages/HoneypotPage'
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/correlated-incidents" element={<CorrelatedIncidentsPage />} />
          <Route path="/attackers" element={<AttackerProfilesPage />} />
          <Route path="/honeypot" element={<HoneypotPage />} />
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
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
