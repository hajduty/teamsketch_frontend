import React, { useEffect, useState } from 'react';
import bg from '../../assets/bg.png';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthProvider';
import axios from 'axios';
import { apiRoutes } from '../../lib/apiRoutes';

const SignIn: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { authenticated, login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (authenticated) navigate('/');
  }, [authenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await axios.post(apiRoutes.auth.login, { email, password });
      login(response.data.token, response.data.user);

      const from = location.state?.from?.pathname;

      if (from) {
        navigate(from);
      } else {
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      console.error("Login failed", err);
      const errorMessage = err.response?.data?.message || 'Invalid credentials. Please try again.';
      setPassword("");
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col md:flex-row">
      <div className="fixed inset-0 md:hidden bg-black">
        <img
          src={bg}
          alt=""
          className="h-full w-full object-cover opacity-50 blur-xl"
        />
      </div>

      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center p-6 md:w-1/2 lg:w-2/5 xl:w-1/3 md:bg-neutral-900 md:border-r md:border-neutral-700">
        <div className="w-full max-w-md bg-neutral-900/70 backdrop-blur-sm rounded-2xl border border-neutral-700/50 p-8 md:bg-transparent md:backdrop-blur-none md:rounded-none md:border-none md:p-0">
          <form className="w-full" onSubmit={handleSubmit}>
            <h1 className="mb-8 text-3xl font-semibold text-white">Sign in</h1>

            <div className="mb-4">
              <label
                className="mb-2 block text-sm font-medium text-neutral-300"
                htmlFor="email"
              >
                Email
              </label>
              <input
                className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-neutral-300 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
                autoComplete="email"
              />
            </div>

            <div className="mb-4">
              <label
                className="mb-2 block text-sm font-medium text-neutral-300"
                htmlFor="password"
              >
                Password
              </label>
              <input
                className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-neutral-300 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
                autoComplete="current-password"
              />
            </div>

            <div className="mb-6 h-5">
              {error && (
                <p className="text-sm text-red-400 animate-in fade-in slide-in-from-top-1 duration-200">
                  {error}
                </p>
              )}
            </div>

            <button
              className="w-full rounded cursor-pointer bg-blue-700 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Logging in...
                </span>
              ) : (
                'Login'
              )}
            </button>

            <div className="my-6 flex items-center justify-center">
              <div className="h-px w-full bg-neutral-700"></div>
              <div className="h-px w-full bg-neutral-700"></div>
            </div>

            <div className="text-center text-sm text-neutral-300">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-medium text-blue-400 transition-colors hover:text-blue-300 focus:outline-none focus:underline"
              >
                Register
              </Link>
            </div>
          </form>
        </div>
      </div>

      <div className="hidden flex-1 bg-neutral-950 md:block">
        <img
          src={bg}
          alt=""
          draggable={false}
          className="h-full w-full object-cover opacity-25 blur-lg"
        />
      </div>
    </div>
  );
};

export default SignIn;