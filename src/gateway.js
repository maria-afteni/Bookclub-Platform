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

app.use(limiter);

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
