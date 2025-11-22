package com.enbd.sentiment.function;

import com.enbd.sentiment.model.Message;
import com.enbd.sentiment.model.ProcessedMessage;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.flink.api.common.functions.MapFunction;
import org.apache.hc.client5.http.classic.methods.HttpPost;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.CloseableHttpResponse;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.core5.http.ContentType;
import org.apache.hc.core5.http.io.entity.StringEntity;
import org.apache.hc.core5.http.io.entity.EntityUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Enriches messages with ML analysis from the ML service
 */
public class MLEnrichmentFunction implements MapFunction<Message, ProcessedMessage> {

    private static final Logger LOG = LoggerFactory.getLogger(MLEnrichmentFunction.class);
    private static final long serialVersionUID = 1L;

    private final String mlServiceUrl;
    private transient CloseableHttpClient httpClient;
    private transient ObjectMapper objectMapper;

    public MLEnrichmentFunction(String mlServiceUrl) {
        this.mlServiceUrl = mlServiceUrl;
    }

    private void ensureInitialized() {
        if (httpClient == null) {
            httpClient = HttpClients.createDefault();
        }
        if (objectMapper == null) {
            objectMapper = new ObjectMapper();
        }
    }

    @Override
    public ProcessedMessage map(Message message) throws Exception {
        ensureInitialized();

        // Create processed message with original data
        ProcessedMessage processed = new ProcessedMessage(message);
        processed.setProcessingTimestamp(Instant.now().toString());

        try {
            // Call ML service
            Map<String, Object> mlResponse = callMLService(message.getText());

            // Extract ML results
            processed.setSentimentScore((Double) mlResponse.get("sentiment_score"));
            processed.setSentimentLabel((String) mlResponse.get("sentiment_label"));
            processed.setConfidence((Double) mlResponse.get("confidence"));
            processed.setEmotion((String) mlResponse.get("emotion"));
            processed.setToxicity((Double) mlResponse.get("toxicity"));
            processed.setChurnRisk((Double) mlResponse.get("churn_risk"));
            processed.setInferenceTimeMs((Double) mlResponse.get("inference_time_ms"));

            // Convert emotion_scores
            @SuppressWarnings("unchecked")
            Map<String, Double> emotionScores = (Map<String, Double>) mlResponse.get("emotion_scores");
            processed.setEmotionScores(emotionScores);

            LOG.debug("Enriched message {}: sentiment={}, emotion={}, churn_risk={}",
                message.getId(),
                processed.getSentimentLabel(),
                processed.getEmotion(),
                processed.getChurnRisk()
            );

        } catch (Exception e) {
            LOG.error("Error calling ML service for message {}: {}", message.getId(), e.getMessage());

            // Set default values on error
            processed.setSentimentScore(0.0);
            processed.setSentimentLabel("neutral");
            processed.setConfidence(0.0);
            processed.setEmotion("neutral");
            processed.setToxicity(0.0);
            processed.setChurnRisk(0.0);
            processed.setInferenceTimeMs(0.0);
        }

        return processed;
    }

    private Map<String, Object> callMLService(String text) throws Exception {
        // Create request payload
        Map<String, Object> payload = new HashMap<>();
        payload.put("text", text);
        payload.put("include_emotion", true);
        payload.put("include_toxicity", true);

        String jsonPayload = objectMapper.writeValueAsString(payload);

        // Create HTTP request
        HttpPost httpPost = new HttpPost(mlServiceUrl + "/analyze");
        httpPost.setEntity(new StringEntity(jsonPayload, ContentType.APPLICATION_JSON));
        httpPost.setHeader("Content-Type", "application/json");

        // Execute request
        try (CloseableHttpResponse response = httpClient.execute(httpPost)) {
            int statusCode = response.getCode();

            if (statusCode == 200) {
                String responseBody = EntityUtils.toString(response.getEntity());
                JsonNode jsonNode = objectMapper.readTree(responseBody);

                // Convert to Map
                Map<String, Object> result = new HashMap<>();
                result.put("sentiment_score", jsonNode.get("sentiment_score").asDouble());
                result.put("sentiment_label", jsonNode.get("sentiment_label").asText());
                result.put("confidence", jsonNode.get("confidence").asDouble());
                result.put("emotion", jsonNode.has("emotion") && !jsonNode.get("emotion").isNull()
                    ? jsonNode.get("emotion").asText() : "neutral");
                result.put("toxicity", jsonNode.has("toxicity") && !jsonNode.get("toxicity").isNull()
                    ? jsonNode.get("toxicity").asDouble() : 0.0);
                result.put("churn_risk", jsonNode.has("churn_risk") && !jsonNode.get("churn_risk").isNull()
                    ? jsonNode.get("churn_risk").asDouble() : 0.0);
                result.put("inference_time_ms", jsonNode.get("inference_time_ms").asDouble());

                // Extract emotion scores
                if (jsonNode.has("emotion_scores") && !jsonNode.get("emotion_scores").isNull()) {
                    Map<String, Double> emotionScores = new HashMap<>();
                    JsonNode emotionNode = jsonNode.get("emotion_scores");
                    emotionNode.fields().forEachRemaining(entry ->
                        emotionScores.put(entry.getKey(), entry.getValue().asDouble())
                    );
                    result.put("emotion_scores", emotionScores);
                }

                return result;

            } else {
                throw new Exception("ML service returned status code: " + statusCode);
            }
        }
    }
}
