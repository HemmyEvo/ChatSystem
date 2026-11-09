import User from '../models/User.js';
import { getPushPublicKey } from '../lib/pushNotifications.js';

const isValidSubscription = (subscription) => {
  if (!subscription || typeof subscription !== 'object') return false;
  try {
    const endpoint = new URL(subscription.endpoint);
    return endpoint.protocol === 'https:'
      && typeof subscription.keys?.p256dh === 'string'
      && typeof subscription.keys?.auth === 'string';
  } catch {
    return false;
  }
};

export const pushController = {
  publicKey: (_req, res) => {
    const key = getPushPublicKey();
    if (!key) return res.status(503).json({ message: 'Push notifications are not configured' });
    return res.status(200).json({ publicKey: key });
  },

  subscribe: async (req, res) => {
    if (!isValidSubscription(req.body)) {
      return res.status(400).json({ message: 'A valid push subscription is required' });
    }
    try {
      await User.updateOne(
        { _id: req.user._id },
        {
          $pull: { pushSubscriptions: { endpoint: req.body.endpoint } },
        },
      );
      await User.updateOne(
        { _id: req.user._id },
        { $addToSet: { pushSubscriptions: req.body } },
      );
      return res.status(201).json({ message: 'Push notifications enabled' });
    } catch (error) {
      console.error('Error saving push subscription:', error);
      return res.status(500).json({ message: 'Unable to save push subscription' });
    }
  },

  unsubscribe: async (req, res) => {
    const { endpoint } = req.body || {};
    if (typeof endpoint !== 'string') {
      return res.status(400).json({ message: 'A push subscription endpoint is required' });
    }
    try {
      await User.updateOne(
        { _id: req.user._id },
        { $pull: { pushSubscriptions: { endpoint } } },
      );
      return res.status(200).json({ message: 'Push notifications disabled' });
    } catch (error) {
      console.error('Error removing push subscription:', error);
      return res.status(500).json({ message: 'Unable to remove push subscription' });
    }
  },
};
