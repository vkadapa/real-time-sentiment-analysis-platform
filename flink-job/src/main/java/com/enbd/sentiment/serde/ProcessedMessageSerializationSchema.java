package com.enbd.sentiment.serde;

import com.enbd.sentiment.model.ProcessedMessage;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.flink.api.common.serialization.SerializationSchema;

/**
 * Serialization schema for processed messages to Kafka
 */
public class ProcessedMessageSerializationSchema implements SerializationSchema<ProcessedMessage> {

    private static final long serialVersionUID = 1L;
    private transient ObjectMapper objectMapper;

    @Override
    public void open(InitializationContext context) throws Exception {
        objectMapper = new ObjectMapper();
    }

    @Override
    public byte[] serialize(ProcessedMessage element) {
        if (objectMapper == null) {
            objectMapper = new ObjectMapper();
        }

        try {
            return objectMapper.writeValueAsBytes(element);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize ProcessedMessage", e);
        }
    }
}
