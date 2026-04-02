import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import UploadPage from './pages/UploadPage';
import JobSetupPage from './pages/JobSetupPage';
import DashboardPage from './pages/DashboardPage';
import JobsPage from './pages/JobsPage';
import DeepResearchPage from './pages/DeepResearchPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/create" element={<Navigate to="/new-job" replace />} />
        <Route path="/dashboard" element={<JobsPage />} />
        <Route path="/new-job" element={<JobSetupPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/analyzing/:jobId" element={<DashboardPage />} />
        <Route path="/analyzing" element={<Navigate to="/dashboard" replace />} />
        <Route path="/research/:jobId" element={<DeepResearchPage />} />
      </Routes>
    </Router>
  );
}

export default App;
