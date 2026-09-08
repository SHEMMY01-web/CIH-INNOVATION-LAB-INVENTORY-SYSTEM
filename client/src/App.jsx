import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AlertProvider } from './contexts/AlertContext';
import AlertPopup from './components/AlertPopup';
import OfflineIndicator from './components/OfflineIndicator';
import Home from './pages/Home';
import Catalog from './pages/Catalog';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Items from './pages/Items';
import Tools from './pages/Tools';
import Assets from './pages/Assets';
import Requests from './pages/Requests';
import GrnReport from './pages/GrnReport';
import ForgotPassword from './pages/ForgotPassword';
import EnterOtp from './pages/EnterOtp';
import UpdatePassword from './pages/UpdatePassword';
import LoginSuccessful from './pages/LoginSuccessful';
import ScrollToTopButton from './components/ScrollToTopButton';

function App() {
  return (
    <Router>
      <AlertProvider>
        <AuthProvider>
          <AlertPopup />
          <OfflineIndicator />
          <ScrollToTopButton />
          <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/items" element={<Items />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/project_detail" element={<ProjectDetail />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/grn-report" element={<GrnReport />} />
          <Route path="/grn_report" element={<GrnReport />} />
          <Route path="/forgot_password" element={<ForgotPassword />} />
          <Route path="/enter_otp" element={<EnterOtp />} />
          <Route path="/update_password" element={<UpdatePassword />} />
          <Route path="/login_successful" element={<LoginSuccessful />} />
        </Routes>
        </AuthProvider>
      </AlertProvider>
    </Router>
  );
}

export default App;
