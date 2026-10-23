// Optional account screen: create one / log in / reset password, or (signed in) sync, sign out, delete.
import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  AccountError, deleteAccount, sendPasswordReset, Session, setNewPassword, signIn, signUp,
} from '../data/account';
import { Button, T } from '../ui/kit';
import { Appear } from '../ui/motion';
import { color, font, size } from '../ui/theme';

type Mode = 'create' | 'login' | 'forgot';

type Props = {
  session: Session | null;
  /** Arrived from a "reset password" email link: ask for the new password. */
  recovery: boolean;
  lastSync: number | null;
  syncing: boolean;
  syncError: string | null;
  notice?: string | null;
  /** Open on "Log in" instead of "Create account". */
  startWithLogin?: boolean;
  onSignedIn: (s: Session) => void;
  onSyncNow: () => void;
  onSignOut: () => void;
  onDeleted: () => void;
  onRecoveryDone: () => void;
  onBack: () => void;
};

function ago(ts: number | null): string {
  if (!ts) return 'not yet';
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} hour${h === 1 ? '' : 's'} ago` : new Date(ts).toLocaleDateString();
}

function Field({ label, value, onChange, secure, onSubmit, autoComplete }: {
  label: string; value: string; onChange: (v: string) => void; secure?: boolean; onSubmit?: () => void;
  autoComplete?: 'email' | 'password' | 'new-password' | 'current-password';
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <T style={styles.label}>{label}</T>
      <TextInput
        value={value} onChangeText={onChange} secureTextEntry={secure}
        accessibilityLabel={label}
        autoCapitalize="none" autoCorrect={false} spellCheck={false}
        keyboardType={secure ? 'default' : 'email-address'}
        autoComplete={autoComplete as never}
        onSubmitEditing={onSubmit} submitBehavior="submit"
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={[styles.input, focused && { borderColor: color.ink }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
      />
    </View>
  );
}

function Link({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={6}>
      <T style={styles.link}>{text}</T>
    </Pressable>
  );
}

const PRIVACY =
  'What is stored: your email and your learning progress (which words you learned and when they are due). ' +
  'Nothing else. Your password is never stored in readable form. You can delete the account and everything in it here at any time.';

export function Account(p: Props) {
  const [mode, setMode] = useState<Mode>(p.startWithLogin ? 'login' : 'create');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(p.notice ?? null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setError(null); setInfo(null); setBusy(true);
    try { await fn(); } catch (e) {
      setError(e instanceof AccountError ? e.message : 'Something went wrong. Please try again.');
    } finally { setBusy(false); }
  };
  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());

  const submit = () => run(async () => {
    if (!emailOk) throw new AccountError('Please enter your email address.');
    if (mode === 'forgot') {
      await sendPasswordReset(email);
      setInfo('If there is an account with this email, a link to set a new password is on its way. Check your inbox (and spam).');
      return;
    }
    if (password.length < 8) throw new AccountError('Your password needs at least 8 characters.');
    if (mode === 'create') {
      const s = await signUp(email, password);
      if (s) p.onSignedIn(s);
      else {
        setInfo('Almost done: we sent a confirmation link to your email. Open it on this device and your progress will be backed up.');
        setMode('login');
      }
    } else {
      p.onSignedIn(await signIn(email, password));
    }
  });

  let content: React.ReactNode;
  if (p.recovery && p.session) {
    content = (
      <>
        <T style={styles.title}>Set a new password</T>
        <T style={styles.sub}>For {p.session.email}</T>
        <Field label="New password (at least 8 characters)" value={password} onChange={setPassword} secure
          autoComplete="new-password"
          onSubmit={() => run(async () => {
            if (password.length < 8) throw new AccountError('Your password needs at least 8 characters.');
            await setNewPassword(p.session!, password); setPassword(''); p.onRecoveryDone();
          })} />
        <Button label={busy ? 'Saving…' : 'Save new password'} disabled={busy} onPress={() => run(async () => {
          if (password.length < 8) throw new AccountError('Your password needs at least 8 characters.');
          await setNewPassword(p.session!, password); setPassword(''); p.onRecoveryDone();
        })} />
      </>
    );
  } else if (p.session) {
    content = (
      <>
        <T style={styles.title}>Your account</T>
        <View style={styles.card}>
          <T style={styles.label}>Signed in as</T>
          <T style={styles.email}>{p.session.email}</T>
          <T style={styles.sub}>
            {p.syncing ? 'Backing up…' : p.syncError ? p.syncError : `Progress backed up ${ago(p.lastSync)}.`}
          </T>
          <T style={styles.sub}>Log in with the same email on another phone or computer and you continue where you left off.</T>
        </View>
        <Button label={p.syncing ? 'Syncing…' : 'Sync now'} disabled={p.syncing} onPress={p.onSyncNow} tint={color.das} />
        <Button label="Sign out" kind="quiet" onPress={p.onSignOut} />
        <T style={styles.small}>Signing out keeps your progress on this device too.</T>
        <View style={styles.danger}>
          {confirmDelete ? (
            <>
              <T style={styles.sub}>This deletes the account and its backup for good. Progress on this device stays.</T>
              <Button label={busy ? 'Deleting…' : 'Delete account for good'} tint={color.wrong} disabled={busy}
                onPress={() => run(async () => { await deleteAccount(p.session!); p.onDeleted(); })} />
              <Button label="Keep my account" kind="quiet" onPress={() => setConfirmDelete(false)} />
            </>
          ) : <Link text="Delete account" onPress={() => setConfirmDelete(true)} />}
        </View>
      </>
    );
  } else {
    content = (
      <>
        <T style={styles.title}>
          {mode === 'create' ? 'Back up your progress' : mode === 'login' ? 'Log in' : 'Forgot your password?'}
        </T>
        <T style={styles.sub}>
          {mode === 'create'
            ? 'Optional. The app works without an account; an account keeps a copy of your progress so you don\'t lose it and can continue on another device.'
            : mode === 'login'
              ? 'Your progress from the account is combined with this device. Nothing gets lost.'
              : 'We\'ll email you a link to set a new one.'}
        </T>
        <Field label="Email" value={email} onChange={setEmail} autoComplete="email" onSubmit={submit} />
        {mode !== 'forgot' ? (
          <Field label={mode === 'create' ? 'Password (at least 8 characters)' : 'Password'} value={password}
            onChange={setPassword} secure autoComplete={mode === 'create' ? 'new-password' : 'current-password'} onSubmit={submit} />
        ) : null}
        <Button disabled={busy} onPress={submit} tint={color.der}
          label={busy ? 'One moment…' : mode === 'create' ? 'Create account' : mode === 'login' ? 'Log in' : 'Send link'} />
        <View style={styles.links}>
          {mode === 'create' ? <Link text="I already have an account" onPress={() => { setMode('login'); setError(null); }} /> : null}
          {mode === 'login' ? <Link text="Create an account" onPress={() => { setMode('create'); setError(null); }} /> : null}
          {mode === 'login' ? <Link text="Forgot password?" onPress={() => { setMode('forgot'); setError(null); setInfo(null); }} /> : null}
          {mode === 'forgot' ? <Link text="Back to log in" onPress={() => { setMode('login'); setError(null); }} /> : null}
        </View>
      </>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <View style={styles.wrap}>
        <Pressable accessibilityRole="button" onPress={p.onBack} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
          <T style={styles.back}>← Back</T>
        </Pressable>
        <Appear key={`${mode}|${!!p.session}|${p.recovery}`}>
          <View style={{ gap: 16 }}>
            {content}
            {error ? <T style={styles.error} accessibilityRole="alert">{error}</T> : null}
            {info ? <T style={styles.info} accessibilityRole="alert">{info}</T> : null}
          </View>
        </Appear>
        {!p.recovery ? <T style={styles.privacy}>{PRIVACY}</T> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 480, alignSelf: 'center', padding: 20, gap: 22 },
  back: { fontSize: size.sm, color: color.muted, fontWeight: '600' },
  title: { fontSize: size.xl, fontWeight: '800', letterSpacing: -0.5 },
  sub: { fontSize: size.sm, color: color.muted, lineHeight: 21 },
  small: { fontSize: size.xs, color: color.muted, textAlign: 'center', marginTop: -8 },
  label: { fontSize: size.xs, color: color.muted, fontWeight: '600' },
  email: { fontSize: size.md, fontWeight: '700' },
  card: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, borderRadius: 14, padding: 16, gap: 6 },
  input: {
    fontFamily: font, fontSize: size.md, color: color.ink, backgroundColor: color.surface,
    borderWidth: 1, borderColor: color.line, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14,
  },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  link: { fontSize: size.sm, color: color.der, fontWeight: '600' },
  error: { fontSize: size.sm, color: color.wrong, backgroundColor: color.wrongWash, padding: 12, borderRadius: 10, lineHeight: 20 },
  info: { fontSize: size.sm, color: color.ink, backgroundColor: color.rightWash, padding: 12, borderRadius: 10, lineHeight: 20 },
  danger: { borderTopWidth: 1, borderColor: color.line, paddingTop: 16, gap: 10 },
  privacy: { fontSize: size.xs, color: color.muted, lineHeight: 18 },
});
