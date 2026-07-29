import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await api.requestPasswordReset(email);
      setMessage(res.message || '如果這個 Email 有對應的帳號,重設密碼信已經寄出');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-xl font-semibold">忘記密碼</h1>
        <p className="mb-6 text-sm text-gray-500">輸入您的 Email,我們會寄送重設密碼的連結給您。</p>
        {message && <p className="mb-4 text-sm text-green-600">{message}</p>}
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        <label className="mb-4 block text-sm">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-gray-900 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? '寄送中…' : '寄送重設連結'}
        </button>
        <p className="mt-4 text-center text-sm text-gray-500">
          <Link to="/login" className="text-gray-900 underline">
            返回登入
          </Link>
        </p>
      </form>
    </div>
  );
}
