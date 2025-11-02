import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AuthPage from './pages/Auth.tsx'
import AdminPage from './pages/Admin.tsx'

export function Root() {
  const path = location.pathname;
  let View = AuthPage;
  if (path.startsWith('/admin')) View = AdminPage;
  else if (path.startsWith('/auth')) View = AuthPage;
  else history.replaceState(null, '', '/auth');
  return (
    <StrictMode>
      <View />
    </StrictMode>
  );
}

createRoot(document.getElementById('root')!).render(<Root />)
