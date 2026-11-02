import { useEffect, type ReactNode } from 'react';

const GROUP = 'BARnBoy Group';
const CONTACT = 'daviscl311@gmail.com';
const UPDATED = 'November 2, 2026';

// Public pages (no sign-in): linked from the sign-up form and given to the text-message carriers for registration.
function Page({ title, children }: { title: string; children: ReactNode }) {
  // The browser tab title is what some reviewers and crawlers read, so it carries the page name and the brand.
  useEffect(() => { document.title = `${title} - ${GROUP}`; }, [title]);
  return (
    <div className="fade-in" style={{ maxWidth: 680, margin: '0 auto', padding: '16px 16px 60px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20 }}>{GROUP.toUpperCase()}</div>
        <a href="/login" className="btn btn-secondary btn-sm" style={{ minHeight: 44, justifyContent: 'center' }}>Back to the app</a>
      </header>
      <h1 className="page-title">{title}</h1>
      <p className="page-subtitle">Last updated {UPDATED}</p>
      <style>{`.legal{font-size:15px;line-height:1.65}.legal h2{font-size:18px;font-weight:700;margin:24px 0 6px}.legal ul{margin:6px 0 6px 20px}.legal p{margin:6px 0}`}</style>
      {children}
    </div>
  );
}

export function Privacy() {
  return (
    <Page title="Privacy Policy">
      <div className="legal">
        <p>{GROUP} runs a private pickleball group and this web app, which is used to schedule games, keep score and show stats. This policy explains what the app collects and how it is used.</p>
        <h2>What we collect</h2>
        <ul>
          <li>Your username and a 4-digit PIN. The PIN is stored only as a one-way hash, never as plain text.</li>
          <li>Your mobile phone number, if you choose to give one, and whether you agreed to receive text messages.</li>
          <li>Game activity: events you join, teams, scores, and chat messages you post in an event.</li>
        </ul>
        <h2>How we use it</h2>
        <ul>
          <li>To run sign-ups, sessions, scores, the leaderboard and the weekly schedule.</li>
          <li>To send scheduling text messages, only if you opted in (see below).</li>
        </ul>
        <h2>Text messages</h2>
        <p>If you opt in, we send scheduling messages only: a weekly question about which days you can play, a confirmation if you are picked, and a reminder the day before a game. We do not send marketing or promotional messages. You can opt out at any time by replying STOP to any message or by turning the option off in Settings.</p>
        <h2>Sharing</h2>
        <p>We do not sell or share your SMS opt-in data or personal information with third parties for marketing purposes. We do not share your phone number or text-message opt-in with third parties or affiliates for marketing or promotional purposes. Service providers that host the app and deliver text messages (our hosting provider and our text-message provider) process your information only to run the app and deliver messages.</p>
        <h2>Who can see what</h2>
        <p>Other group members can see your username in event rosters, the schedule, the leaderboard and chat. Your phone number is visible only to you and the group organizer.</p>
        <h2>Keeping and deleting your information</h2>
        <p>You can delete your account in Settings, which removes your account and activity. You can also email {CONTACT} to ask us to delete or correct your information.</p>
        <h2>Contact</h2>
        <p>Questions about this policy: <a href={`mailto:${CONTACT}`} style={{ textDecoration: 'underline' }}>{CONTACT}</a>.</p>
      </div>
    </Page>
  );
}

export function Terms() {
  return (
    <Page title="Terms and Conditions">
      <div className="legal">
        <p>These terms and conditions cover the {GROUP} pickleball app and its optional text-message program.</p>
        <h2>The text-message program</h2>
        <ul>
          <li><b>Program:</b> {GROUP} Pickleball Texts.</li>
          <li><b>What you get:</b> scheduling messages only. A weekly question about which days you can play, a confirmation if you are picked, and a reminder the day before a game.</li>
          <li><b>How often:</b> about one to three messages a week.</li>
          <li><b>Cost:</b> message and data rates may apply, depending on your mobile plan.</li>
          <li><b>Opt in:</b> you agree when you tick the text-message option on the sign-up form or in Settings. It is never required to use the app.</li>
          <li><b>Opt out:</b> reply STOP to any message, or turn the option off in Settings. You will get one confirmation and no more messages. Reply START to rejoin.</li>
          <li><b>Help:</b> reply HELP, or email {CONTACT}.</li>
          <li>Carriers are not liable for delayed or undelivered messages.</li>
        </ul>
        <h2>Using the app</h2>
        <p>Keep your PIN private. Be respectful in chat. The organizer may remove accounts that misuse the app. The app is provided as is, for a friendly group.</p>
        <h2>Privacy</h2>
        <p>See the <a href="/privacy" style={{ textDecoration: 'underline' }}>Privacy Policy</a> for how your information is handled.</p>
        <h2>Contact</h2>
        <p><a href={`mailto:${CONTACT}`} style={{ textDecoration: 'underline' }}>{CONTACT}</a></p>
      </div>
    </Page>
  );
}
