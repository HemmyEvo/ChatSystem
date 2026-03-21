const APP_VERSION_STORAGE_KEY = 'existoDeployVersion';
const APP_RELOAD_STORAGE_KEY = 'existoDeployReloadVersion';

const LOCAL_STORAGE_KEYS_TO_CLEAR = [
  'archivedChatIds',
  'pinnedChatIds',
  'soundSettings',
  'existoRingtone',
  'existoRingtoneName',
  'chatBackground',
  'chatBgOpacity',
  'chatBubbleColors',
  'activeGameSessionId',
];

const SESSION_STORAGE_KEYS_TO_CLEAR = [
  'activeCallSession',
];

const clearStorageKeys = (storage, keys) => {
  keys.forEach((key) => {
    try {
      storage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to clear storage key "${key}":`, error);
    }
  });
};

const clearClientCaches = async () => {
  if (typeof window === 'undefined' || !('caches' in window)) return;

  try {
    const cacheKeys = await window.caches.keys();
    await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
  } catch (error) {
    console.warn('Failed to clear browser caches:', error);
  }
};

const resetServiceWorkers = async () => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch (error) {
    console.warn('Failed to reset service workers:', error);
  }
};

const refreshServiceWorkers = async () => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.update()));
  } catch (error) {
    console.warn('Failed to refresh service workers:', error);
  }
};

export const syncClientDeployment = async (appVersion) => {
  if (typeof window === 'undefined' || !appVersion) return;

  const lastVersion = window.localStorage.getItem(APP_VERSION_STORAGE_KEY);

  if (lastVersion === appVersion) {
    if (window.sessionStorage.getItem(APP_RELOAD_STORAGE_KEY) === appVersion) {
      window.sessionStorage.removeItem(APP_RELOAD_STORAGE_KEY);
    }
    await refreshServiceWorkers();
    return;
  }

  clearStorageKeys(window.localStorage, LOCAL_STORAGE_KEYS_TO_CLEAR);
  clearStorageKeys(window.sessionStorage, SESSION_STORAGE_KEYS_TO_CLEAR);
  await Promise.all([clearClientCaches(), resetServiceWorkers()]);
  window.localStorage.setItem(APP_VERSION_STORAGE_KEY, appVersion);

  if (lastVersion && window.sessionStorage.getItem(APP_RELOAD_STORAGE_KEY) !== appVersion) {
    window.sessionStorage.setItem(APP_RELOAD_STORAGE_KEY, appVersion);
    window.location.reload();
  }
};
