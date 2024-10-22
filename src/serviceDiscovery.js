const express = require('express');
const redis = require('redis');

const SERVICE_PORT = 50051; // Port for the service discovery API
const REDIS_PORT = 6379; // Port for Redis

const redisClient = redis.createClient({
    url: `redis://localhost:${REDIS_PORT}`
});

redisClient.connect().catch(err => console.error('Failed to connect to Redis:', err));

const app = express();
app.use(express.json());

app.post('/register', async (req, res) => {
    const { name, address, port } = req.body;

    if (!name || !address || !port) {
        return res.status(400).json({ success: false, message: 'Missing required fields: name, address, port' });
    }

    const serviceInfo = `${address}:${port}`;
    
    try {
        await redisClient.lPush(name, serviceInfo);
        console.log(`Registered service: ${name}`);
        res.status(200).json({ success: true, message: 'Service registered successfully' });
    } catch (err) {
        console.error('Failed to register service:', err);
        res.status(500).json({ success: false, message: 'Failed to register service' });
    }
});

app.get('/service/:name', async (req, res) => {
    const serviceKey = req.params.name;

    try {
        const services = await redisClient.lRange(serviceKey, 0, -1); // Get all instances of the service
        if (services.length > 0) {
            const [address, port] = services[0].split(':'); // Return the first instance
            res.status(200).json({ address, port });
        } else {
            res.status(404).json({ address: '', port: '', message: 'Service not found' }); // No service found
        }
    } catch (err) {
        console.error('Failed to retrieve service:', err);
        res.status(500).json({ address: '', port: '', message: 'Failed to retrieve service' });
    }
});

app.get('/status', (_req, res) => {
    res.status(200).json({ status: 'OK', message: 'Service discovery is running' });
});

app.listen(SERVICE_PORT, () => {
    console.log(`Service Discovery API running on port ${SERVICE_PORT}`);
});
