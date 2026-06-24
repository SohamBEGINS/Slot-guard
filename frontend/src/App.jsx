import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SetupPage from './pages/SetupPage';
import AdminLayout from './components/AdminLayout';
import ZoneIntelligence from './pages/ZoneIntelligence';
import UrbanMap from './pages/UrbanMap';
import CheckoutPage from './pages/CheckoutPage';
import MLOpsDashboard from './pages/MLOpsDashboard';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Pages */}
        <Route path="/" element={<SetupPage />} />

        {/* Admin Dashboard (sidebar layout wraps all admin pages) */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/zones" replace />} />
          <Route path="zones" element={<ZoneIntelligence />} />
          <Route path="map" element={<UrbanMap />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="mlops" element={<MLOpsDashboard />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
