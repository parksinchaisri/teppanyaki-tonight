import { Navigate, Route, Routes } from 'react-router-dom';
import { useApp } from './store/appContext';
import { JoinScreen } from './components/onboarding/JoinScreen';
import { MainApp } from './components/MainApp';
import { AdminApp } from './admin/AdminApp';

export default function App() {
  const { session } = useApp();
  return (
    <Routes>
      <Route path="/" element={session ? <Navigate to="/play" replace /> : <JoinScreen />} />
      <Route path="/play" element={session ? <MainApp /> : <Navigate to="/" replace />} />
      <Route path="/admin" element={<AdminApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
