import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function CourtIllustration() {
  return (
    <svg
      viewBox="0 0 300 400"
      style={{
        width: '100%',
        maxWidth: 300,
        margin: '0 auto',
        display: 'block',
      }}
    >
      <rect
        x="40"
        y="20"
        width="220"
        height="360"
        rx="6"
        fill="none"
        stroke="var(--white)"
        strokeWidth="3"
        opacity="0.9"
      />

      <rect
        x="40"
        y="140"
        width="220"
        height="60"
        fill="var(--yellow)"
        opacity="0.14"
      />

      <rect
        x="40"
        y="200"
        width="220"
        height="60"
        fill="var(--yellow)"
        opacity="0.14"
      />

      <line
        x1="40"
        y1="200"
        x2="260"
        y2="200"
        stroke="var(--white)"
        strokeWidth="5"
        opacity="0.9"
      />

      <line
        x1="150"
        y1="20"
        x2="150"
        y2="140"
        stroke="var(--white)"
        strokeWidth="2"
        opacity="0.7"
      />

      <line
        x1="150"
        y1="260"
        x2="150"
        y2="380"
        stroke="var(--white)"
        strokeWidth="2"
        opacity="0.7"
      />

      <circle
        cx="250"
        cy="352"
        r="15"
        fill="var(--yellow)"
      />

      <circle cx="245" cy="347" r="1.6" fill="var(--green)" />
      <circle cx="255" cy="347" r="1.6" fill="var(--green)" />
      <circle cx="250" cy="356" r="1.6" fill="var(--green)" />
      <circle cx="243" cy="357" r="1.6" fill="var(--green)" />
      <circle cx="257" cy="357" r="1.6" fill="var(--green)" />
    </svg>
  );
}

interface FloatingInputProps {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  numeric?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
}

function FloatingInput({
  label,
  type = 'text',
  value,
  onChange,
  numeric = false,
  maxLength,
  autoFocus = false,
}: FloatingInputProps) {
  const [focused, setFocused] = useState(false);

  const floated = focused || value.length > 0;

  const handleChange = (newValue: string) => {
    if (numeric) {
      newValue = newValue.replace(/\D/g, '');
    }

    if (maxLength) {
      newValue = newValue.slice(0, maxLength);
    }

    onChange(newValue);
  };

  return (
    <div
      style={{
        position: 'relative',
        marginBottom: 36,
      }}
    >
      <label
        style={{
          position: 'absolute',
          left: 0,
          pointerEvents: 'none',
          top: floated ? -18 : 8,
          fontSize: floated ? 12 : 18,
          color: floated
            ? 'var(--green)'
            : 'var(--gray-500)',
          fontWeight: floated ? 700 : 400,
          letterSpacing: floated ? 0.4 : 0,
          transition: 'all 0.18s ease',
        }}
      >
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        inputMode={numeric ? 'numeric' : undefined}
        maxLength={maxLength}
        style={{
          width: '100%',
          border: 'none',
          borderBottom: `2px solid ${
            focused
              ? 'var(--yellow)'
              : 'var(--gray-300)'
          }`,
          background: 'transparent',
          fontSize: 20,
          padding: '8px 0',
          outline: 'none',
          fontFamily: 'var(--font-body)',
          color: 'var(--charcoal)',
          transition: 'border-color 0.18s ease',
        }}
      />
    </div>
  );
}

export default function Login() {
  const [mode, setMode] =
    useState<'login' | 'register'>('login');

  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [smsOptIn, setSmsOptIn] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Please enter a username');
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits');
      return;
    }

    if (
      mode === 'register' &&
      pin !== confirmPin
    ) {
      setError('PINs do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (mode === 'register') {
        await register(name, pin, phoneNumber, smsOptIn);
      } else {
        await login(name, pin);
      }

      navigate('/events');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : mode === 'register'
          ? 'Account creation failed'
          : 'Login failed'
      );
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode((current) =>
      current === 'login'
        ? 'register'
        : 'login'
    );

    setError('');
    setPin('');
    setConfirmPin('');
    setPhoneNumber('');
    setSmsOptIn(false);
  };

  return (
    <div className="login-split">

      {/* LEFT SIDE — SAME PICKLEBALL COURT */}
      <div className="login-art-panel">
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 34,
            color: 'var(--white)',
            lineHeight: 1.05,
            textAlign: 'center',
          }}
        >
          BARN BOYS
          <br />
          SCOREBOOK
        </div>

        <div
          style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.55)',
            marginTop: 10,
            marginBottom: 24,
            textAlign: 'center',
          }}
        >
          Every game. Every score. One shared book.
        </div>

        <CourtIllustration />
      </div>

      {/* RIGHT SIDE */}
      <div className="login-form-panel">
        <div className="login-form-card fade-in">

          {/* MOBILE BRAND */}
          <div className="login-mobile-brand">
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 24,
                color: 'var(--charcoal)',
              }}
            >
              BARN BOYS SCOREBOOK
            </div>
          </div>

          {/* TITLE */}
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 28,
              color: 'var(--charcoal)',
            }}
          >
            {mode === 'login'
              ? 'Sign in'
              : 'Create account'}
          </div>

          {/* DESCRIPTION */}
          <div
            style={{
              fontSize: 13,
              color: 'var(--gray-500)',
              marginTop: 6,
              marginBottom: 30,
            }}
          >
            {mode === 'login'
              ? 'Enter your username and 4-digit PIN.'
              : 'Choose a username and 4-digit PIN for your account.'}
          </div>

          <form onSubmit={handleSubmit}>

            {/* USERNAME */}
            <FloatingInput
              label="Username"
              value={name}
              onChange={setName}
              autoFocus
            />

            {/* PIN */}
            <FloatingInput
              label="4-digit PIN"
              type="password"
              value={pin}
              onChange={setPin}
              numeric
              maxLength={4}
            />

            {/* CONFIRM PIN ONLY WHEN REGISTERING */}
            {mode === 'register' && (
              <>
                <FloatingInput
                  label="Confirm PIN"
                  type="password"
                  value={confirmPin}
                  onChange={setConfirmPin}
                  numeric
                  maxLength={4}
                />
                <FloatingInput
                  label="Phone number (optional)"
                  type="tel"
                  value={phoneNumber}
                  onChange={setPhoneNumber}
                  numeric
                  maxLength={15}
                />
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 22, fontSize: 13, color: 'var(--gray-700)' }}>
                  <input type="checkbox" checked={smsOptIn} onChange={e => setSmsOptIn(e.target.checked)} style={{ marginTop: 4, accentColor: 'var(--green)' }} />
                  <span>Send me text notifications about my pickleball events.</span>
                </label>
              </>
            )}

            {/* ERROR */}
            {error && (
              <div
                style={{
                  background: 'var(--danger-light)',
                  color: 'var(--danger)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  marginBottom: 14,
                }}
              >
                {error}
              </div>
            )}

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              className="login-submit-btn"
              disabled={loading}
            >
              <span>
                {loading
                  ? mode === 'login'
                    ? 'Signing in...'
                    : 'Creating account...'
                  : mode === 'login'
                  ? 'Enter app'
                  : 'Create account'}
              </span>
            </button>

            {/* SWITCH LOGIN / REGISTER */}
            <div
              style={{
                textAlign: 'center',
                marginTop: 22,
                fontSize: 13,
                color: 'var(--gray-500)',
              }}
            >
              {mode === 'login'
                ? "Don't have an account?"
                : 'Already have an account?'}

              {' '}

              <button
                type="button"
                onClick={switchMode}
                style={{
                  border: 'none',
                  background: 'none',
                  padding: 0,
                  color: 'var(--green)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {mode === 'login'
                  ? 'Create one'
                  : 'Sign in'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}