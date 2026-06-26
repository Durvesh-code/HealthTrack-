import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Toast } from './hooks/useToast';
import AppRoutes from './routes';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toast />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;