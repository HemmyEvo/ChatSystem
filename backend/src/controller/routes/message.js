import express from 'express';

const router = express.Router();

router.post('/send', (req, res) => {
    // Handle sending a message
    res.send('Send message endpoint');
});

router.get("/receive", (req, res) => {
    // Handle receiving messages
    res.send('Receive messages endpoint');
});

export default router;