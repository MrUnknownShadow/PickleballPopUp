import { FormEvent, useEffect, useState } from 'react';
import { Bell, Check, Trash2, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../hooks/useApi';
import type { UserProfile } from '../types';

export default function Settings() {
  const { username, apiFetch } = useAuth();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { show, Notification } = useNotification();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [deletePin, setDeletePin] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!username) return;
    apiFetch<UserProfile>(`/api/users/${encodeURIComponent(username)}`)
      .then(data => {
        setProfile(data);
        setPhoneNumber(data.phonenumber ?? '');
        setSmsOptIn(data.smsoptin);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Unable to load settings'))
      .finally(() => setLoading(false));
  }, [apiFetch, username]);

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await apiFetch<UserProfile>(`/api/users/${encodeURIComponent(username ?? '')}/settings`, {
        method: 'PATCH',
        body: JSON.stringify({ phoneNumber, smsOptIn }),
      });
      setProfile(updated);
      setPhoneNumber(updated.phonenumber ?? '');
      setSmsOptIn(updated.smsoptin);
      show('Settings saved', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save settings');
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    setError('');
    try {
      await apiFetch(`/api/users/${encodeURIComponent(username ?? '')}`, {
        method: 'DELETE',
        body: JSON.stringify({ pin: deletePin }),
      });
      logout();
      navigate('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete account');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray-500)' }}>Loading settings...</div>;

  return (
    <div className="fade-in" style={{ maxWidth: 760, margin: '0 auto' }}>
      {Notification}
      <div style={{ marginBottom: 24 }}>
        <div className="page-title">Settings</div>
        <div className="page-subtitle">Manage your account and notification preferences</div>
      </div>

      {error && <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: 16, fontSize: 13 }}>{error}</div>}

      <form onSubmit={saveSettings}>
        <section className="card" style={{ padding: 24, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <UserRound size={18} color="var(--green)" />
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24 }}>Account information</h2>
          </div>
          <div className="grid-2">
            <div><div className="stat-label">Username</div><div style={{ marginTop: 4, fontWeight: 600 }}>{profile?.username}</div></div>
            <div><div className="stat-label">Member since</div><div style={{ marginTop: 4, fontWeight: 600 }}>{profile?.createdat ? new Date(profile.createdat).toLocaleDateString() : '—'}</div></div>
          </div>
        </section>

        <section className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Bell size={18} color="var(--green)" />
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24 }}>Notification preferences</h2>
          </div>
          <p style={{ color: 'var(--gray-500)', fontSize: 13, marginBottom: 20 }}>Text notifications are optional. Calendar and event access is always available.</p>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 7 }}>Phone number</label>
          <input className="settings-input" type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 15))} placeholder="Optional phone number" />
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 18, fontSize: 14, color: 'var(--charcoal)', cursor: 'pointer' }}>
            <input type="checkbox" checked={smsOptIn} onChange={e => setSmsOptIn(e.target.checked)} style={{ marginTop: 4, accentColor: 'var(--green)' }} />
            <span><strong>Enable Text Notifications</strong><br /><span style={{ color: 'var(--gray-500)', fontSize: 13 }}>You can unsubscribe at any time by turning this off or replying STOP.</span></span>
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}><Check size={15} />{saving ? 'Saving...' : 'Save settings'}</button>
          </div>
        </section>

        <section className="card" style={{ padding: 24, marginTop: 16, borderColor: '#edc4bf' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Trash2 size={18} color="var(--danger)" />
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--danger)' }}>Delete account</h2>
          </div>
          <p style={{ color: 'var(--gray-500)', fontSize: 13, marginBottom: 16 }}>This permanently removes your account, event participation, and messages.</p>
          {!showDelete ? (
            <button type="button" className="btn btn-danger" onClick={() => setShowDelete(true)}><Trash2 size={15} /> Delete account</button>
          ) : (
            <div style={{ background: 'var(--danger-light)', padding: 14, borderRadius: 'var(--radius-md)' }}>
              <div style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Enter your 4-digit PIN to confirm.</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input className="settings-input" style={{ maxWidth: 180 }} type="password" inputMode="numeric" maxLength={4} value={deletePin} onChange={e => setDeletePin(e.target.value.replace(/\D/g, ''))} placeholder="4-digit PIN" />
                <button type="button" className="btn btn-danger" disabled={deleting || deletePin.length !== 4} onClick={deleteAccount}>{deleting ? 'Deleting...' : 'Permanently delete'}</button>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowDelete(false); setDeletePin(''); }}>Cancel</button>
              </div>
            </div>
          )}
        </section>
      </form>
    </div>
  );
}