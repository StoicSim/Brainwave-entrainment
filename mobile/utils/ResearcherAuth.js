import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCOUNTS_KEY = 'researcher_accounts';
const CURRENT_USER_KEY = 'researcher_current_user';
const AUTH_KEY = 'researcher_logged_in';
let _isLoggedIn = false;
export const isLoggedInSync = () => _isLoggedIn;
// Default account — always exists as fallback
const DEFAULT_ACCOUNTS = [
  {
    username: 'researcher',
    password: 'neuroflow2025',
    name: '',
    age: '',
    gender: '',
    createdAt: new Date().toISOString(),
  },
];

// ── Account Management ──────────────────────────────────────────────────────

export const getAccounts = async () => {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
    if (!raw) {
      await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(DEFAULT_ACCOUNTS));
      return DEFAULT_ACCOUNTS;
    }
    return JSON.parse(raw);
  } catch (error) {
    console.warn('getAccounts error:', error.message);
    return DEFAULT_ACCOUNTS;
  }
};

export const saveAccounts = async (accounts) => {
  try {
    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (error) {
    console.warn('saveAccounts error:', error.message);
  }
};

export const registerResearcher = async (username, password) => {
  if (!username.trim() || !password.trim()) {
    return { success: false, error: 'Username and password are required.' };
  }
  if (username.trim().length < 3) {
    return { success: false, error: 'Username must be at least 3 characters.' };
  }
  if (password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters.' };
  }

  const accounts = await getAccounts();
  const exists = accounts.find(
    (a) => a.username.toLowerCase() === username.trim().toLowerCase()
  );
  if (exists) {
    return { success: false, error: 'Username already taken. Choose another.' };
  }

  const newAccount = {
    username: username.trim().toLowerCase(),
    password,
    name: '',
    age: '',
    gender: '',
    createdAt: new Date().toISOString(),
  };

  await saveAccounts([...accounts, newAccount]);
  return { success: true };
};

export const loginResearcher = async (username, password) => {
  const accounts = await getAccounts();
  const account = accounts.find(
    (a) =>
      a.username.toLowerCase() === username.trim().toLowerCase() &&
      a.password === password
  );
  if (!account) {
    return { success: false, error: 'Incorrect username or password.' };
  }
  await AsyncStorage.setItem(AUTH_KEY, 'true');
  await AsyncStorage.setItem(CURRENT_USER_KEY, account.username.toLowerCase());
  _isLoggedIn = true;
  return { success: true, account };
};

export const logoutResearcher = async () => {
  try {
    _isLoggedIn = false
    await AsyncStorage.removeItem(AUTH_KEY);
    await AsyncStorage.removeItem(CURRENT_USER_KEY);
  } catch (error) {
    console.warn('logoutResearcher error:', error.message);
  }
};

export const getCurrentUser = async () => {
  try {
    const username = await AsyncStorage.getItem(CURRENT_USER_KEY);
    if (!username) return null;
    const accounts = await getAccounts();
    return accounts.find((a) => a.username === username) || null;
  } catch (error) {
    console.warn('getCurrentUser error:', error.message);
    return null;
  }
};

export const updateCurrentUserProfile = async (updates) => {
  try {
    const username = await AsyncStorage.getItem(CURRENT_USER_KEY);
    if (!username) return { success: false, error: 'Not logged in.' };
    const accounts = await getAccounts();
    const updated = accounts.map((a) =>
      a.username === username ? { ...a, ...updates } : a
    );
    await saveAccounts(updated);
    return { success: true };
  } catch (error) {
    console.warn('updateCurrentUserProfile error:', error.message);
    return { success: false, error: error.message };
  }
};

export const isLoggedIn = async () => {
  try {
    const val = await AsyncStorage.getItem(AUTH_KEY);
    return val === 'true';
  } catch {
    return false;
  }
};

// ── Per-Researcher Session Storage ─────────────────────────────────────────

const sessionKey = (username) => `sessions_${username}`;

export const getSessions = async () => {
  try {
    const username = await AsyncStorage.getItem(CURRENT_USER_KEY);
    if (!username) return [];
    const raw = await AsyncStorage.getItem(sessionKey(username));
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.warn('getSessions error:', error.message);
    return [];
  }
};

export const saveSession = async (session) => {
  try {
    const username = await AsyncStorage.getItem(CURRENT_USER_KEY);
    if (!username) return;
    const existing = await getSessions();
    const updated = [session, ...existing];
    await AsyncStorage.setItem(sessionKey(username), JSON.stringify(updated));
  } catch (error) {
    console.warn('saveSession error:', error.message);
  }
};

export const deleteSession = async (sessionId) => {
  try {
    const username = await AsyncStorage.getItem(CURRENT_USER_KEY);
    if (!username) return;
    const existing = await getSessions();
    const updated = existing.filter((s) => s.id !== sessionId);
    await AsyncStorage.setItem(sessionKey(username), JSON.stringify(updated));
  } catch (error) {
    console.warn('deleteSession error:', error.message);
  }
};