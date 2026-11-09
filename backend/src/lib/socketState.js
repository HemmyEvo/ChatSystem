const noopTarget = { emit: () => false };

export let io = {
  to: () => noopTarget,
  emit: () => false,
};

export const setSocketIO = (socketServer) => {
  io = socketServer;
};

export const userSocketMap = {};

export const getReceiverSocketId = (userId) => userSocketMap[userId?.toString()];
