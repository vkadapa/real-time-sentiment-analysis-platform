export interface ProcessedMessage {
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
  sentiment_label: 'positive' | 'negative' | 'neutral';
  confidence: number;
  emotion: string;
  emotion_scores: { [key: string]: number };
  toxicity: number;
  churn_risk: number;
  inference_time_ms: number;
  processing_timestamp: string;
}

export interface AggregatedMetrics {
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

export interface GeoMetrics {
  [city: string]: AggregatedMetrics;
}

export interface ProductMetrics {
  [product: string]: AggregatedMetrics;
}

export interface ChannelMetrics {
  [channel: string]: AggregatedMetrics;
}
