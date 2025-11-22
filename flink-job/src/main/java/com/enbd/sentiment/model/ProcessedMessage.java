package com.enbd.sentiment.model;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.io.Serializable;
import java.util.Map;

/**
 * Processed message with ML analysis results
 */
public class ProcessedMessage implements Serializable {

    private static final long serialVersionUID = 1L;

    // Original message fields
    @JsonProperty("id")
    private String id;

    @JsonProperty("text")
    private String text;

    @JsonProperty("platform")
    private String platform;

    @JsonProperty("author")
    private String author;

    @JsonProperty("timestamp")
    private String timestamp;

    @JsonProperty("city")
    private String city;

    @JsonProperty("product")
    private String product;

    @JsonProperty("channel")
    private String channel;

    @JsonProperty("device")
    private String device;

    @JsonProperty("language")
    private String language;

    // ML analysis results
    @JsonProperty("sentiment_score")
    private Double sentimentScore;

    @JsonProperty("sentiment_label")
    private String sentimentLabel;

    @JsonProperty("confidence")
    private Double confidence;

    @JsonProperty("emotion")
    private String emotion;

    @JsonProperty("emotion_scores")
    private Map<String, Double> emotionScores;

    @JsonProperty("toxicity")
    private Double toxicity;

    @JsonProperty("churn_risk")
    private Double churnRisk;

    @JsonProperty("inference_time_ms")
    private Double inferenceTimeMs;

    // Metadata
    @JsonProperty("source")
    private String source;

    @JsonProperty("processing_timestamp")
    private String processingTimestamp;

    @JsonProperty("metrics")
    private Map<String, Object> metrics;

    // Constructors
    public ProcessedMessage() {}

    public ProcessedMessage(Message message) {
        this.id = message.getId();
        this.text = message.getText();
        this.platform = message.getPlatform();
        this.author = message.getAuthor();
        this.timestamp = message.getTimestamp();
        this.city = message.getCity();
        this.product = message.getProduct();
        this.channel = message.getChannel();
        this.device = message.getDevice();
        this.language = message.getLanguage();
        this.source = message.getSource();
        this.metrics = message.getMetrics();
    }

    // Getters and Setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public String getPlatform() {
        return platform;
    }

    public void setPlatform(String platform) {
        this.platform = platform;
    }

    public String getAuthor() {
        return author;
    }

    public void setAuthor(String author) {
        this.author = author;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getProduct() {
        return product;
    }

    public void setProduct(String product) {
        this.product = product;
    }

    public String getChannel() {
        return channel;
    }

    public void setChannel(String channel) {
        this.channel = channel;
    }

    public String getDevice() {
        return device;
    }

    public void setDevice(String device) {
        this.device = device;
    }

    public String getLanguage() {
        return language;
    }

    public void setLanguage(String language) {
        this.language = language;
    }

    public Double getSentimentScore() {
        return sentimentScore;
    }

    public void setSentimentScore(Double sentimentScore) {
        this.sentimentScore = sentimentScore;
    }

    public String getSentimentLabel() {
        return sentimentLabel;
    }

    public void setSentimentLabel(String sentimentLabel) {
        this.sentimentLabel = sentimentLabel;
    }

    public Double getConfidence() {
        return confidence;
    }

    public void setConfidence(Double confidence) {
        this.confidence = confidence;
    }

    public String getEmotion() {
        return emotion;
    }

    public void setEmotion(String emotion) {
        this.emotion = emotion;
    }

    public Map<String, Double> getEmotionScores() {
        return emotionScores;
    }

    public void setEmotionScores(Map<String, Double> emotionScores) {
        this.emotionScores = emotionScores;
    }

    public Double getToxicity() {
        return toxicity;
    }

    public void setToxicity(Double toxicity) {
        this.toxicity = toxicity;
    }

    public Double getChurnRisk() {
        return churnRisk;
    }

    public void setChurnRisk(Double churnRisk) {
        this.churnRisk = churnRisk;
    }

    public Double getInferenceTimeMs() {
        return inferenceTimeMs;
    }

    public void setInferenceTimeMs(Double inferenceTimeMs) {
        this.inferenceTimeMs = inferenceTimeMs;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getProcessingTimestamp() {
        return processingTimestamp;
    }

    public void setProcessingTimestamp(String processingTimestamp) {
        this.processingTimestamp = processingTimestamp;
    }

    public Map<String, Object> getMetrics() {
        return metrics;
    }

    public void setMetrics(Map<String, Object> metrics) {
        this.metrics = metrics;
    }

    @Override
    public String toString() {
        return "ProcessedMessage{" +
                "id='" + id + '\'' +
                ", sentimentScore=" + sentimentScore +
                ", sentimentLabel='" + sentimentLabel + '\'' +
                ", emotion='" + emotion + '\'' +
                ", churnRisk=" + churnRisk +
                '}';
    }
}
