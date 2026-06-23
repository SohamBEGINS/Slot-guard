import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SetupPage from './pages/SetupPage';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SetupPage />} />
        <Route path="/admin" element={<AdminDashboard />} /> {/* ADD THIS */}
      </Routes>
    </Router>
  );
}

export default App;
