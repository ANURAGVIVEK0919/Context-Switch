import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../api';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await login(email, password);
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify({ email }));
      window.location.href = '/'; // Hard reload to clear states
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md p-8 border border-outline bg-surface-dim shadow-2xl rounded-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black text-primary-container tracking-tighter uppercase" style={{ fontFamily: 'Space Grotesk' }}>
            ContextSwitch
          </h1>
          <p className="text-tertiary font-mono text-xs uppercase tracking-widest mt-2">Sign in to your account</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-error-container/20 border-l-4 border-error text-error text-xs font-mono uppercase tracking-wider animate-pulse">
            <span className="font-bold">Access Denied:</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={`space-y-6 ${error ? 'animate-shake' : ''}`}>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-on-surface-variant mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface border border-outline px-4 py-3 text-on-surface font-mono text-sm focus:border-primary-container outline-none transition-all"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-on-surface-variant mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface border border-outline px-4 py-3 text-on-surface font-mono text-sm focus:border-primary-container outline-none transition-all"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-container text-on-primary-container py-3 font-mono text-xs uppercase tracking-[0.2em] font-bold hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-outline text-center">
          <p className="text-tertiary font-mono text-[10px] uppercase tracking-wider">
            New here? <Link to="/register" className="text-primary-container hover:underline ml-1">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
