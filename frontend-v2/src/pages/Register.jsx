import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../api';

function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    setLoading(true);
    setError('');
    try {
      const res = await register(email, password);
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify({ email }));
      window.location.href = '/'; 
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
          <p className="text-tertiary font-mono text-xs uppercase tracking-widest mt-2">Create your account</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-error-container text-on-error-container text-xs font-mono border border-error uppercase">
            Error: {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
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
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-on-surface-variant mb-2">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-surface border border-outline px-4 py-3 text-on-surface font-mono text-sm focus:border-primary-container outline-none transition-all"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-container text-on-primary-container py-3 font-mono text-xs uppercase tracking-[0.2em] font-bold hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-outline text-center">
          <p className="text-tertiary font-mono text-[10px] uppercase tracking-wider">
            Already have an account? <Link to="/login" className="text-primary-container hover:underline ml-1">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
