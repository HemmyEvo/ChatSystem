import webpush from 'web-push';
import User from '../models/User.js';

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const pushEnabled = Boolean(publicKey && privateKey);

if (pushEnabled) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', publicKey, privateKey);
}

export const getPushPublicKey = () => (pushEnabled ? publicKey : null);

export const sendPushNotification = async (userId, payload) => {
  if (!pushEnabled) return;
  const user = await User.findById(userId).select('pushSubscriptions');
  if (!user?.pushSubscriptions?.length) return;

  await Promise.all(user.pushSubscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await User.updateOne(
          { _id: userId },
          { $pull: { pushSubscriptions: { endpoint: subscription.endpoint } } },
        );
        return;
      }
      console.error('Push notification delivery failed:', error);
    }
  }));
};
