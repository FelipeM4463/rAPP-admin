import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { Shell } from './components/Shell';
import { CatalogPage } from './pages/CatalogPage';
import { DetailPage } from './pages/DetailPage';
import { FormPage } from './pages/FormPage';
import { LoginPage } from './pages/LoginPage';

function PrivateLayout() {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<PrivateLayout />}>
        <Route path="/" element={<CatalogPage />} />
        <Route path="/republicas/nova" element={<FormPage />} />
        <Route path="/republicas/:id" element={<DetailPage />} />
        <Route path="/republicas/:id/editar" element={<FormPage />} />
      </Route>
    </Routes>
  );
}
