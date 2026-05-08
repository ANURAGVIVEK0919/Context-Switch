import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import Projects from './pages/Projects';
import Sessions from './pages/Sessions';
import BrainDumps from './pages/BrainDumps';
import AISynthesis from './pages/AISynthesis';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import { ThemeProvider } from './ThemeContext';

function RequireAuth({ children }) {
  const token = localStorage.getItem('token');
  // Strict check: must be a truthy string and not 'null'/'undefined'
  if (!token || token === 'undefined' || token === 'null' || token.trim() === '') {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes */}
          <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index element={<Overview />} />
            <Route path="projects" element={<Projects />} />
            <Route path="sessions" element={<Sessions />} />
            <Route path="brain-dumps" element={<BrainDumps />} />
            <Route path="ai-synthesis" element={<AISynthesis />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
