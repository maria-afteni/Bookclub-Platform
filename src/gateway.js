const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit'); 
const redis = require('redis');
const { URL } = require('url');

const app = express();
app.use(express.json());

const VOTING_SERVICE_URL = 'http://localhost:5000'; 
const DISCUSSION_SERVICE_URL = 'http://localhost:5001';  

const ERROR_THRESHOLD = 3;
const TIMEOUT_LIMIT = 30000;

async function handleCircuitBreaker(serviceKey, serviceUrl) {
    const failureCountKey = `${serviceKey}:${serviceUrl}:failures`;
    const timeoutKey = `${serviceKey}:${serviceUrl}:timeout`;

    const isServiceInTimeout = await redisClient.exists(timeoutKey);
    const failureCount = await redisClient.get(failureCountKey) || 0;

    if (isServiceInTimeout) {
        console.log(`${serviceKey} ${serviceUrl} is in timeout, skipping failure increment.`);
        return;
    }

    await redisClient.incr(failureCountKey);
    const currentFailureCount = await redisClient.get(failureCountKey);

    if (Number(currentFailureCount) === 1) {
        await redisClient.set(timeoutKey, '1');
        await redisClient.expire(timeoutKey, TIMEOUT_LIMIT / 1000);
    }

    if (Number(currentFailureCount) >= ERROR_THRESHOLD) {
        await redisClient.del(failureCountKey);
        await redisClient.lRem(serviceKey, 0, serviceUrl.replace(/^http:\/\//, ''));
        console.log(`${serviceKey} ${serviceUrl} is no longer available due to consecutive errors`);
    }
}


const services = [
    "http://localhost:5000",
    "http://localhost:5001",
    "http://localhost:5002",
    "http://localhost:5003",
    "http://localhost:5004",
    "http://localhost:5005"
];

let currentServiceIndex = 0;

const getNextService = () => {
    const service = services[currentServiceIndex];
    currentServiceIndex = (currentServiceIndex + 1) % services.length;
    return service;
};

const redisClient = redis.createClient({
    url: `redis://${"localhost"}:${6379}`
});

redisClient.connect().catch(err => {
    console.error('Redis connection error:', err);
});

const limiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes window
    max: 10, // 10 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes'
});

app.use(limiter);

let currentIndexes = {}; 

async function getRoundRobinService(serviceKey) {
    const services = await redisClient.lRange(serviceKey, 0, -1); 

    if (services.length === 0) {
        throw new Error(`${serviceKey} not available`);
    }

    if (!currentIndexes[serviceKey]) {
        currentIndexes[serviceKey] = 0;
    }

    const serviceUrl = services[currentIndexes[serviceKey]];
    currentIndexes[serviceKey] = (currentIndexes[serviceKey] + 1) % services.length;

    return serviceUrl;
}

app.all('/proxy/:serviceName/:path(*)', async (req, res) => {
    const serviceKey = req.params.serviceName; 
    const targetUrl = await getRoundRobinService(serviceKey);

    console.log(`Forwarding request to: ${targetUrl}`); 

    try {
        const response = await axios({
            method: req.method,
            url: `http://${targetUrl}/${req.params.path}`, 
            headers: { ...req.headers, host: new URL(targetUrl).host }, 
            data: req.body,
            params: req.query 
        });

        await redisClient.set(`${serviceKey}:${targetUrl}:failures`, '0');
        res.status(response.status).send(response.data); 
    } catch (error) {
        console.error('Error forwarding request:', error.response ? error.response.data : error.message);
        await handleCircuitBreaker(serviceKey, targetUrl);
        res.status(error.response ? error.response.status : 500).json({
            message: 'Error forwarding request',
            error: error.response ? error.response.data : error.message
        });
    }
});

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
