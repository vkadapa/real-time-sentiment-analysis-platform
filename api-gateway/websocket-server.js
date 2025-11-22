const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { Kafka } = require('kafkajs');
const { createClient } = require('redis');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const winston = require('winston');
require('dotenv').config();

// Configure logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// Configuration
const PORT = process.env.PORT || 3001;
const KAFKA_BOOTSTRAP_SERVERS = (process.env.KAFKA_BOOTSTRAP_SERVERS || 'localhost:9092').split(',');
const KAFKA_TOPIC = process.env.KAFKA_TOPIC || 'sentiment.processed';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'enbd_jwt_secret_change_in_prod';

// Initialize Express
const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors({
    origin: CORS_ORIGIN,
    credentials: true
}));
app.use(express.json());

// Initialize Socket.io
const io = new Server(httpServer, {
    cors: {
        origin: CORS_ORIGIN,
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Initialize Redis
const redis = createClient({
    socket: {
        host: REDIS_HOST,
        port: REDIS_PORT
    },
    password: REDIS_PASSWORD
});

redis.on('error', (err) => logger.error('Redis error:', err));
redis.on('connect', () => logger.info('Connected to Redis'));

// Initialize Kafka
const kafka = new Kafka({
    clientId: 'api-gateway',
    brokers: KAFKA_BOOTSTRAP_SERVERS
});

const consumer = kafka.consumer({
    groupId: 'api-gateway-group',
    sessionTimeout: 30000
});

// Connection tracking
let connectedClients = 0;
let messagesStreamed = 0;

// JWT Authentication Middleware for Socket.io
io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
        // For demo purposes, allow connections without token
        // In production, you should enforce authentication
        logger.warn('Client connected without token');
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.userId = decoded.userId;
        next();
    } catch (err) {
        logger.error('Invalid token:', err.message);
        next(new Error('Authentication error'));
    }
});

// Socket.io connection handler
io.on('connection', (socket) => {
    connectedClients++;
    logger.info(`Client connected: ${socket.id} (Total: ${connectedClients})`);

    // Send initial metrics on connection
    sendInitialMetrics(socket);

    // Handle client disconnection
    socket.on('disconnect', () => {
        connectedClients--;
        logger.info(`Client disconnected: ${socket.id} (Total: ${connectedClients})`);
    });

    // Handle metrics request
    socket.on('request:metrics', async (data) => {
        try {
            const metrics = await getMetrics(data.type, data.key);
            socket.emit('metrics:update', metrics);
        } catch (error) {
            logger.error('Error fetching metrics:', error);
            socket.emit('error', { message: 'Failed to fetch metrics' });
        }
    });
});

// Send initial metrics to newly connected client
async function sendInitialMetrics(socket) {
    try {
        const overallMetrics = await getMetrics('overall', null);
        socket.emit('metrics:initial', overallMetrics);
    } catch (error) {
        logger.error('Error sending initial metrics:', error);
    }
}

// Fetch metrics from Redis
async function getMetrics(type, key) {
    let redisKey;

    if (type === 'overall') {
        redisKey = 'sentiment:overall';
    } else {
        redisKey = `sentiment:${type}:${key}`;
    }

    const data = await redis.hGetAll(redisKey);

    if (!data || Object.keys(data).length === 0) {
        return {
            count: 0,
            avg_sentiment: 0,
            positive_count: 0,
            negative_count: 0,
            neutral_count: 0,
            avg_churn_risk: 0,
            high_churn_count: 0,
            avg_toxicity: 0,
            last_updated: new Date().toISOString(),
            emotion_distribution: {}
        };
    }

    return {
        count: parseInt(data.count || '0'),
        avg_sentiment: parseFloat(data.avg_sentiment || '0'),
        positive_count: parseInt(data.positive_count || '0'),
        negative_count: parseInt(data.negative_count || '0'),
        neutral_count: parseInt(data.neutral_count || '0'),
        avg_churn_risk: parseFloat(data.avg_churn_risk || '0'),
        high_churn_count: parseInt(data.high_churn_count || '0'),
        avg_toxicity: parseFloat(data.avg_toxicity || '0'),
        last_updated: data.last_updated || new Date().toISOString(),
        emotion_distribution: data.emotion_distribution ? JSON.parse(data.emotion_distribution) : {}
    };
}

// REST API Endpoints
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        connections: connectedClients,
        messages_streamed: messagesStreamed,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/metrics/overall', async (req, res) => {
    try {
        const metrics = await getMetrics('overall', null);
        res.json(metrics);
    } catch (error) {
        logger.error('Error fetching overall metrics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/metrics/geo', async (req, res) => {
    try {
        const cities = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman'];
        const metrics = {};

        for (const city of cities) {
            metrics[city] = await getMetrics('geo', city);
        }

        res.json(metrics);
    } catch (error) {
        logger.error('Error fetching geo metrics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/metrics/products', async (req, res) => {
    try {
        const products = ['Credit Card', 'Personal Loan', 'Mortgage', 'Savings Account', 'Investment', 'Insurance'];
        const metrics = {};

        for (const product of products) {
            metrics[product] = await getMetrics('product', product);
        }

        res.json(metrics);
    } catch (error) {
        logger.error('Error fetching product metrics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/metrics/channels', async (req, res) => {
    try {
        const channels = ['Mobile App', 'Website', 'Branch', 'Call Center', 'Social Media'];
        const metrics = {};

        for (const channel of channels) {
            metrics[channel] = await getMetrics('channel', channel);
        }

        res.json(metrics);
    } catch (error) {
        logger.error('Error fetching channel metrics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/auth/token', (req, res) => {
    // Simple token generation for demo
    // In production, integrate with your auth system
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
});

// Start Kafka consumer to stream messages to WebSocket clients
async function startKafkaConsumer() {
    try {
        await consumer.connect();
        await consumer.subscribe({ topic: KAFKA_TOPIC, fromBeginning: false });

        logger.info('Kafka consumer started');

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                try {
                    if (!message.value) return;

                    const processedMessage = JSON.parse(message.value.toString());

                    // Emit to all connected clients
                    io.emit('message:new', processedMessage);

                    // Emit alerts for high churn risk
                    if (processedMessage.churn_risk > 0.7) {
                        io.emit('alert:churn', {
                            message: processedMessage,
                            timestamp: new Date().toISOString()
                        });
                    }

                    messagesStreamed++;

                    if (messagesStreamed % 100 === 0) {
                        logger.info(`Streamed ${messagesStreamed} messages to ${connectedClients} clients`);
                    }

                } catch (error) {
                    logger.error('Error processing Kafka message:', error);
                }
            }
        });

    } catch (error) {
        logger.error('Error starting Kafka consumer:', error);
        throw error;
    }
}

// Initialize and start server
async function start() {
    try {
        // Connect to Redis
        await redis.connect();

        // Start Kafka consumer
        await startKafkaConsumer();

        // Start HTTP server
        httpServer.listen(PORT, () => {
            logger.info('='.repeat(60));
            logger.info(`API Gateway running on port ${PORT}`);
            logger.info(`WebSocket endpoint: ws://localhost:${PORT}`);
            logger.info(`Health check: http://localhost:${PORT}/health`);
            logger.info('='.repeat(60));
        });

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
async function shutdown() {
    logger.info('Shutting down gracefully...');

    try {
        await consumer.disconnect();
        await redis.quit();
        httpServer.close();
        logger.info('Shutdown complete');
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
    }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the server
start();
