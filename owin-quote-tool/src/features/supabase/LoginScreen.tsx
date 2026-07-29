import { useState } from 'react';
import { Lock, UserRound } from 'lucide-react';
import { signInWithPassword } from './auth';

/** Màn đăng nhập admin. Đăng nhập 1 lần, phiên tự nhớ. */
export function LoginScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signInWithPassword(identifier, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đăng nhập lúc này. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="card login-card" onSubmit={submit} noValidate>
        <div className="login-brand">
          <img
            src={`${import.meta.env.BASE_URL}owin-user-assets/logo/logo.webp`}
            alt="OWIN"
            width={64}
            height={64}
            decoding="async"
          />
          <h1>OWIN · Công cụ báo giá</h1>
          <p className="muted">Đăng nhập để quản lý sản phẩm, báo giá & tính nhôm</p>
        </div>

        <label className="field">
          <span>
            <UserRound size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} aria-hidden />
            Tên đăng nhập hoặc email
          </span>
          <input
            className="input"
            type="text"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="vd. admin hoặc email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            autoFocus
            disabled={busy}
          />
        </label>

        <label className="field">
          <span>
            <Lock size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} aria-hidden />
            Mật khẩu
          </span>
          <input
            className="input"
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="Nhập mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={busy}
          />
        </label>

        {error ? (
          <div className="login-error" role="alert">
            {error}
          </div>
        ) : null}

        <button className="btn btn-primary" type="submit" disabled={busy || !identifier.trim() || !password}>
          {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  );
}
