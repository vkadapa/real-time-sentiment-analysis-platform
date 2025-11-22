package com.enbd.sentiment.serde;

import com.enbd.sentiment.model.Message;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.flink.api.common.serialization.DeserializationSchema;
import org.apache.flink.api.common.typeinfo.TypeInformation;

import java.io.IOException;

/**
 * Deserialization schema for raw messages from Kafka
 */
public class MessageDeserializationSchema implements DeserializationSchema<Message> {

    private static final long serialVersionUID = 1L;
    private transient ObjectMapper objectMapper;

    @Override
    public void open(InitializationContext context) throws Exception {
        objectMapper = new ObjectMapper();
    }

    @Override
    public Message deserialize(byte[] message) throws IOException {
        if (objectMapper == null) {
            objectMapper = new ObjectMapper();
        }
        return objectMapper.readValue(message, Message.class);
    }

    @Override
    public boolean isEndOfStream(Message nextElement) {
        return false;
    }

    @Override
    public TypeInformation<Message> getProducedType() {
        return TypeInformation.of(Message.class);
    }
}
