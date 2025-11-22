package com.enbd.sentiment.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.io.Serializable;
import java.util.Map;

/**
 * Raw message from social media platforms
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class Message implements Serializable {

    private static final long serialVersionUID = 1L;

    @JsonProperty("id")
    private String id;

    @JsonProperty("text")
    private String text;

    @JsonProperty("platform")
    private String platform;

    @JsonProperty("author")
    private String author;

    @JsonProperty("author_id")
    private String authorId;

    @JsonProperty("timestamp")
    private String timestamp;

    @JsonProperty("location")
    private String location;

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

    @JsonProperty("metrics")
    private Map<String, Object> metrics;

    @JsonProperty("entities")
    private Map<String, Object> entities;

    @JsonProperty("metadata")
    private Map<String, Object> metadata;

    @JsonProperty("source")
    private String source;

    @JsonProperty("ingestion_timestamp")
    private String ingestionTimestamp;

    // Constructors
    public Message() {}

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

    public String getAuthorId() {
        return authorId;
    }

    public void setAuthorId(String authorId) {
        this.authorId = authorId;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
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

    public Map<String, Object> getMetrics() {
        return metrics;
    }

    public void setMetrics(Map<String, Object> metrics) {
        this.metrics = metrics;
    }

    public Map<String, Object> getEntities() {
        return entities;
    }

    public void setEntities(Map<String, Object> entities) {
        this.entities = entities;
    }

    public Map<String, Object> getMetadata() {
        return metadata;
    }

    public void setMetadata(Map<String, Object> metadata) {
        this.metadata = metadata;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getIngestionTimestamp() {
        return ingestionTimestamp;
    }

    public void setIngestionTimestamp(String ingestionTimestamp) {
        this.ingestionTimestamp = ingestionTimestamp;
    }

    @Override
    public String toString() {
        return "Message{" +
                "id='" + id + '\'' +
                ", platform='" + platform + '\'' +
                ", text='" + (text != null ? text.substring(0, Math.min(50, text.length())) : "null") + "..." + '\'' +
                '}';
    }
}
