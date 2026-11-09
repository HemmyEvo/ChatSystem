import { api } from './axios';

const decodeVapidKey = (key) => {
  const paddedKey = `${key}${'='.repeat((4 - (key.length % 4)) % 4)}`;
  const base64 = paddedKey.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
};

export const enablePushNotifications = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('Push notifications are not supported in this browser.');
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted.');

  const { data } = await api.get('/push/public-key');
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeVapidKey(data.publicKey),
  });
  await api.post('/push/subscription', subscription.toJSON());
  return subscription;
};

export const disablePushNotifications = async () => {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await api.delete('/push/subscription', { data: { endpoint: subscription.endpoint } });
  await subscription.unsubscribe();
};
