import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SetupPage from './pages/SetupPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/setup" replace />} />

        {/* The beautiful setup page we just built */}
        <Route path="/setup" element={<SetupPage />} />

        {/* Placeholder routes (We build these next!) */}
        <Route path="/admin" element={<div className="p-10 text-2xl font-bold text-center mt-20">Admin Dashboard Loading...</div>} />
        <Route path="/checkout" element={<div className="p-10 text-2xl font-bold text-center mt-20">Checkout Loading...</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
