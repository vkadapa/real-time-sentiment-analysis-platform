import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { createClient, RedisClientType } from 'redis';
import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import winston from 'winston';
import * as dotenv from 'dotenv';

dotenv.config();

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

// Types
interface ProcessedMessage {
    id: string;
    text: string;
    platform: string;
    author: string;
    timestamp: string;
    city: string;
    product: string;
    channel: string;
    device: string;
    sentiment_score: number;
    sentiment_label: string;
    confidence: number;
    emotion: string;
    emotion_scores: { [key: string]: number };
    toxicity: number;
    churn_risk: number;
    inference_time_ms: number;
    processing_timestamp: string;
    metrics?: any;
}

interface AggregatedMetrics {
    count: number;
    avg_sentiment: number;
    positive_count: number;
    negative_count: number;
    neutral_count: number;
    avg_churn_risk: number;
    high_churn_count: number;
    avg_toxicity: number;
    last_updated: string;
    emotion_distribution: { [key: string]: number };
}

class AggregatorService {
    private kafka: Kafka;
    private consumer: Consumer;
    private redis: RedisClientType;
    private elasticsearch: ElasticsearchClient;
    private messagesProcessed: number = 0;
    private windowStart: Date;
    private windowData: Map<string, ProcessedMessage[]> = new Map();

    constructor() {
        // Initialize Kafka
        this.kafka = new Kafka({
            clientId: 'sentiment-aggregator',
            brokers: (process.env.KAFKA_BOOTSTRAP_SERVERS || 'localhost:9092').split(',')
        });

        this.consumer = this.kafka.consumer({
            groupId: process.env.KAFKA_GROUP_ID || 'aggregator-group',
            sessionTimeout: 30000,
            heartbeatInterval: 3000
        });

        // Initialize Redis
        this.redis = createClient({
            socket: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379')
            },
            password: process.env.REDIS_PASSWORD
        });

        // Initialize Elasticsearch
        this.elasticsearch = new ElasticsearchClient({
            node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200'
        });

        this.windowStart = new Date();
    }

    async initialize(): Promise<void> {
        try {
            // Connect to Redis
            await this.redis.connect();
            logger.info('Connected to Redis');

            // Test Elasticsearch connection
            await this.elasticsearch.ping();
            logger.info('Connected to Elasticsearch');

            // Create Elasticsearch index template
            await this.createIndexTemplate();

            // Connect Kafka consumer
            await this.consumer.connect();
            await this.consumer.subscribe({
                topics: [process.env.KAFKA_TOPIC || 'sentiment.processed'],
                fromBeginning: false
            });
            logger.info('Connected to Kafka');

        } catch (error) {
            logger.error('Initialization failed:', error);
            throw error;
        }
    }

    private async createIndexTemplate(): Promise<void> {
        try {
            const templateExists = await this.elasticsearch.indices.existsIndexTemplate({
                name: 'sentiment-messages'
            });

            if (!templateExists) {
                await this.elasticsearch.indices.putIndexTemplate({
                    name: 'sentiment-messages',
                    index_patterns: ['sentiment-messages-*'],
                    template: {
                        settings: {
                            number_of_shards: 2,
                            number_of_replicas: 1
                        },
                        mappings: {
                            properties: {
                                id: { type: 'keyword' },
                                text: { type: 'text' },
                                platform: { type: 'keyword' },
                                city: { type: 'keyword' },
                                product: { type: 'keyword' },
                                channel: { type: 'keyword' },
                                sentiment_score: { type: 'float' },
                                sentiment_label: { type: 'keyword' },
                                emotion: { type: 'keyword' },
                                toxicity: { type: 'float' },
                                churn_risk: { type: 'float' },
                                timestamp: { type: 'date' },
                                processing_timestamp: { type: 'date' }
                            }
                        }
                    }
                });

                logger.info('Created Elasticsearch index template');
            }
        } catch (error) {
            logger.error('Error creating index template:', error);
        }
    }

    private async processMessage(message: ProcessedMessage): Promise<void> {
        try {
            // Store in Elasticsearch
            await this.storeInElasticsearch(message);

            // Add to window data
            const keys = [
                `geo:${message.city}`,
                `product:${message.product}`,
                `channel:${message.channel}`,
                `platform:${message.platform}`,
                'overall'
            ];

            for (const key of keys) {
                if (!this.windowData.has(key)) {
                    this.windowData.set(key, []);
                }
                this.windowData.get(key)!.push(message);
            }

            this.messagesProcessed++;

            // Aggregate every window interval
            const aggregationWindow = parseInt(process.env.AGGREGATION_WINDOW || '60000');
            const now = new Date();
            const elapsed = now.getTime() - this.windowStart.getTime();

            if (elapsed >= aggregationWindow) {
                await this.aggregateAndStore();
                this.windowData.clear();
                this.windowStart = new Date();
            }

        } catch (error) {
            logger.error('Error processing message:', error);
        }
    }

    private async storeInElasticsearch(message: ProcessedMessage): Promise<void> {
        try {
            const indexName = `sentiment-messages-${new Date().toISOString().split('T')[0]}`;

            await this.elasticsearch.index({
                index: indexName,
                document: message
            });

        } catch (error) {
            logger.error('Error storing in Elasticsearch:', error);
        }
    }

    private computeMetrics(messages: ProcessedMessage[]): AggregatedMetrics {
        if (messages.length === 0) {
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

        const metrics: AggregatedMetrics = {
            count: messages.length,
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

        let totalSentiment = 0;
        let totalChurnRisk = 0;
        let totalToxicity = 0;

        for (const msg of messages) {
            // Sentiment
            totalSentiment += msg.sentiment_score || 0;

            if (msg.sentiment_label === 'positive') metrics.positive_count++;
            else if (msg.sentiment_label === 'negative') metrics.negative_count++;
            else metrics.neutral_count++;

            // Churn risk
            totalChurnRisk += msg.churn_risk || 0;
            if ((msg.churn_risk || 0) > 0.7) metrics.high_churn_count++;

            // Toxicity
            totalToxicity += msg.toxicity || 0;

            // Emotion distribution
            if (msg.emotion) {
                metrics.emotion_distribution[msg.emotion] =
                    (metrics.emotion_distribution[msg.emotion] || 0) + 1;
            }
        }

        metrics.avg_sentiment = totalSentiment / messages.length;
        metrics.avg_churn_risk = totalChurnRisk / messages.length;
        metrics.avg_toxicity = totalToxicity / messages.length;

        return metrics;
    }

    private async aggregateAndStore(): Promise<void> {
        logger.info(`Aggregating ${this.windowData.size} metrics groups...`);

        const pipeline = this.redis.multi();

        for (const [key, messages] of this.windowData.entries()) {
            const metrics = this.computeMetrics(messages);
            const redisKey = `sentiment:${key}`;

            // Store in Redis
            pipeline.hSet(redisKey, {
                count: metrics.count.toString(),
                avg_sentiment: metrics.avg_sentiment.toFixed(3),
                positive_count: metrics.positive_count.toString(),
                negative_count: metrics.negative_count.toString(),
                neutral_count: metrics.neutral_count.toString(),
                avg_churn_risk: metrics.avg_churn_risk.toFixed(3),
                high_churn_count: metrics.high_churn_count.toString(),
                avg_toxicity: metrics.avg_toxicity.toFixed(3),
                last_updated: metrics.last_updated,
                emotion_distribution: JSON.stringify(metrics.emotion_distribution)
            });

            // Set expiry (24 hours)
            pipeline.expire(redisKey, 86400);
        }

        await pipeline.exec();

        logger.info(`Aggregation complete. Messages processed: ${this.messagesProcessed}`);
    }

    async run(): Promise<void> {
        await this.initialize();

        logger.info('Starting Aggregator Service...');

        await this.consumer.run({
            eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
                try {
                    if (!message.value) return;

                    const processedMessage: ProcessedMessage = JSON.parse(
                        message.value.toString()
                    );

                    await this.processMessage(processedMessage);

                    if (this.messagesProcessed % 100 === 0) {
                        logger.info(`Processed ${this.messagesProcessed} messages`);
                    }

                } catch (error) {
                    logger.error('Error handling message:', error);
                }
            }
        });
    }

    async shutdown(): Promise<void> {
        logger.info('Shutting down...');

        // Final aggregation
        if (this.windowData.size > 0) {
            await this.aggregateAndStore();
        }

        await this.consumer.disconnect();
        await this.redis.quit();
        await this.elasticsearch.close();

        logger.info('Shutdown complete');
    }
}

// Main execution
const service = new AggregatorService();

process.on('SIGTERM', async () => {
    await service.shutdown();
    process.exit(0);
});

process.on('SIGINT', async () => {
    await service.shutdown();
    process.exit(0);
});

service.run().catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
});
