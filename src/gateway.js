const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit'); 

const app = express();
app.use(express.json());

const VOTING_SERVICE_URL = 'http://localhost:5000'; 
const DISCUSSION_SERVICE_URL = 'http://localhost:5001';  

const limiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes window
    max: 10, // 10 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes'
});

const redis = require('redis');

const redisClient = redis.createClient({
    url: `redis://${"localhost"}:${6379}`
});

redisClient.connect().catch(err => {
    console.error('Redis connection error:', err);
});

app.use(limiter);

app.get('/status', async (req, res) => {
    try {
        const votingStatus = await axios.get(`${VOTING_SERVICE_URL}/status`);
        const discussionStatus = await axios.get(`${DISCUSSION_SERVICE_URL}/status`);

        res.status(200).json({
            voting_service: {
                status: votingStatus.data.status,
                timestamp: votingStatus.data.timestamp
            },
            discussion_service: {
                status: discussionStatus.data.status,
                timestamp: discussionStatus.data.timestamp
            }
        });
    } catch (error) {
        console.error('Error fetching service status:', error);
        res.status(500).json({ message: 'Error fetching service status' });
    }
});

app.post('/register', async (req, res) => {
    const { name, address, port } = req.body;
    
    if (!name || !address || !port) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const serviceKey = name;

    try {
        const serviceInfo = `${address}:${port}`;
        await redisClient.lPush(serviceKey, serviceInfo);
        console.log(`Registered service: ${serviceKey} at ${serviceInfo}`);
        return res.status(200).json({ success: true, message: 'Service registered successfully' });
    } catch (error) {
        console.error('Failed to register service:', error);
        return res.status(500).json({ success: false, message: 'Failed to register service' });
    }
});

app.get('/services/:name', async (req, res) => {
    const serviceKey = req.params.name;

    try {
        const services = await redisClient.lRange(serviceKey, 0, -1); // Get all instances of the service
        if (services.length > 0) {
            res.status(200).json({ services });
        } else {
            res.status(404).json({ message: 'No services found' });
        }
    } catch (error) {
        console.error('Failed to retrieve services:', error);
        res.status(500).json({ error: 'Failed to retrieve services' });
    }
});

app.get('/books', async (req, res) => {
    try {
        const response = await axios.get(`${VOTING_SERVICE_URL}/books`);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching books' });
    }
});

app.post('/vote', async (req, res) => {
    try {
        const response = await axios.post(`${VOTING_SERVICE_URL}/vote`, req.body);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(500).json({ message: 'Error submitting vote' });
    }
});

app.post('/vote/end', async (req, res) => {
    try {
        const response = await axios.post(`${VOTING_SERVICE_URL}/vote/end`);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(500).json({ message: 'Error ending voting' });
    }
});

app.get('/discussions', async (req, res) => {
    try {
        const response = await axios.get(`${DISCUSSION_SERVICE_URL}/discussions`);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching discussions' });
    }
});

app.post('/discussions', async (req, res) => {
    try {
        const response = await axios.post(`${DISCUSSION_SERVICE_URL}/discussions`, req.body);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(500).json({ message: 'Error creating discussion' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Gateway running on http://localhost:${PORT}`);
});
