import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import VirtualAssistant from '@/components/VirtualAssistant';
import LandingPage from '@/pages/LandingPage';
import DashboardPage from '@/pages/DashboardPage';
import ReportFormPage from '@/pages/ReportFormPage';
import ReportDetailPage from '@/pages/ReportDetailPage';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-white">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/report" element={<ReportFormPage />} />
            <Route path="/report/:id" element={<ReportDetailPage />} />
          </Routes>
        </main>
        <Footer />
        <VirtualAssistant />
      </div>
    </BrowserRouter>
  );
}

export default App;
