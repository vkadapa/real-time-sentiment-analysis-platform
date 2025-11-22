package com.enbd.sentiment;

import com.enbd.sentiment.function.MLEnrichmentFunction;
import com.enbd.sentiment.model.Message;
import com.enbd.sentiment.model.ProcessedMessage;
import com.enbd.sentiment.serde.MessageDeserializationSchema;
import com.enbd.sentiment.serde.ProcessedMessageSerializationSchema;
import org.apache.flink.api.common.eventtime.WatermarkStrategy;
import org.apache.flink.connector.kafka.sink.KafkaRecordSerializationSchema;
import org.apache.flink.connector.kafka.sink.KafkaSink;
import org.apache.flink.connector.kafka.source.KafkaSource;
import org.apache.flink.connector.kafka.source.enumerator.initializer.OffsetsInitializer;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.apache.flink.api.common.restartstrategy.RestartStrategies;
import org.apache.flink.api.common.time.Time;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.TimeUnit;

/**
 * Main Flink job for real-time sentiment analysis
 * Reads from sentiment.raw, enriches with ML analysis, writes to sentiment.processed
 */
public class SentimentAnalysisJob {

    private static final Logger LOG = LoggerFactory.getLogger(SentimentAnalysisJob.class);

    public static void main(String[] args) throws Exception {
        // Configuration
        final String kafkaBootstrapServers = System.getenv().getOrDefault(
            "KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"
        );
        final String mlServiceUrl = System.getenv().getOrDefault(
            "ML_SERVICE_URL", "http://ml-service:8000"
        );
        final String inputTopic = "sentiment.raw";
        final String outputTopic = "sentiment.processed";
        final String consumerGroup = "flink-sentiment-processor";

        LOG.info("Starting Sentiment Analysis Flink Job");
        LOG.info("Kafka Bootstrap Servers: {}", kafkaBootstrapServers);
        LOG.info("ML Service URL: {}", mlServiceUrl);
        LOG.info("Input Topic: {}", inputTopic);
        LOG.info("Output Topic: {}", outputTopic);

        // Create execution environment
        final StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();

        // Configure checkpointing
        env.enableCheckpointing(60000); // Checkpoint every 60 seconds
        env.getCheckpointConfig().setMinPauseBetweenCheckpoints(30000);
        env.getCheckpointConfig().setCheckpointTimeout(120000);
        env.getCheckpointConfig().setMaxConcurrentCheckpoints(1);

        // Configure restart strategy
        env.setRestartStrategy(RestartStrategies.fixedDelayRestart(
            3, // Number of restart attempts
            Time.of(10, TimeUnit.SECONDS) // Delay between restarts
        ));

        // Set parallelism
        env.setParallelism(2);

        // Create Kafka source
        KafkaSource<Message> source = KafkaSource.<Message>builder()
            .setBootstrapServers(kafkaBootstrapServers)
            .setTopics(inputTopic)
            .setGroupId(consumerGroup)
            .setStartingOffsets(OffsetsInitializer.latest())
            .setValueOnlyDeserializer(new MessageDeserializationSchema())
            .build();

        // Create Kafka sink
        KafkaSink<ProcessedMessage> sink = KafkaSink.<ProcessedMessage>builder()
            .setBootstrapServers(kafkaBootstrapServers)
            .setRecordSerializer(KafkaRecordSerializationSchema.builder()
                .setTopic(outputTopic)
                .setValueSerializationSchema(new ProcessedMessageSerializationSchema())
                .build()
            )
            .build();

        // Define data pipeline
        DataStream<Message> rawMessages = env
            .fromSource(source, WatermarkStrategy.noWatermarks(), "Kafka Source")
            .name("Raw Messages");

        // Filter and clean messages
        DataStream<Message> cleanedMessages = rawMessages
            .filter(message -> message != null && message.getText() != null && !message.getText().isEmpty())
            .name("Clean Messages");

        // Enrich with ML analysis
        DataStream<ProcessedMessage> processedMessages = cleanedMessages
            .map(new MLEnrichmentFunction(mlServiceUrl))
            .name("ML Enrichment");

        // Write to Kafka
        processedMessages.sinkTo(sink).name("Kafka Sink");

        // Execute job
        env.execute("ENBD Sentiment Analysis Job");
    }
}
