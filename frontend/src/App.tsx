import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import UploadPage from './pages/UploadPage';
import JobSetupPage from './pages/JobSetupPage';
import DashboardPage from './pages/DashboardPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/create" element={<Navigate to="/new-job" replace />} />
        <Route path="/new-job" element={<JobSetupPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/analyzing" element={<DashboardPage />} />
      </Routes>
    </Router>
  );
}

export default App;
