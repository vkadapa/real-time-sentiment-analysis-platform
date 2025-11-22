"""
Twitter Connector for Real-Time Sentiment Analysis
Uses Twitter API v2 with OAuth 2.0 Bearer Token
Implements rate limiting, retry logic, and Kafka integration
"""

import os
import json
import time
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from collections import deque

import tweepy
from kafka import KafkaProducer
from kafka.errors import KafkaError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Rate limiter using sliding window algorithm
    """
    def __init__(self, max_requests: int, window_ms: int):
        self.max_requests = max_requests
        self.window_ms = window_ms
        self.requests = deque()

    def is_allowed(self) -> bool:
        """Check if request is allowed"""
        now = time.time() * 1000  # Convert to milliseconds
        window_start = now - self.window_ms

        # Remove old requests outside the window
        while self.requests and self.requests[0] < window_start:
            self.requests.popleft()

        # Check if we're under the limit
        if len(self.requests) < self.max_requests:
            self.requests.append(now)
            return True

        return False

    def wait_time(self) -> float:
        """Calculate wait time in seconds"""
        if not self.requests:
            return 0

        now = time.time() * 1000
        window_start = now - self.window_ms
        oldest_request = self.requests[0]

        if oldest_request >= window_start:
            wait_ms = oldest_request - window_start
            return wait_ms / 1000

        return 0


class TwitterConnector:
    """
    Twitter API v2 Connector with rate limiting and Kafka integration
    """

    def __init__(self):
        self.bearer_token = os.getenv("TWITTER_BEARER_TOKEN")
        self.kafka_bootstrap_servers = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
        self.kafka_topic = os.getenv("KAFKA_TOPIC", "sentiment.raw")

        # Twitter API configuration
        self.keywords = os.getenv("TWITTER_KEYWORDS", "banking,finance").split(",")
        self.languages = os.getenv("TWITTER_LANGUAGES", "en").split(",")

        # Rate limiting configuration
        rate_limit_window = int(os.getenv("RATE_LIMIT_WINDOW", 900000))  # 15 minutes in ms
        rate_limit_max = int(os.getenv("RATE_LIMIT_MAX_REQUESTS", 300))  # Twitter API limit
        self.rate_limiter = RateLimiter(rate_limit_max, rate_limit_window)

        # Retry configuration
        self.max_retries = 3
        self.base_backoff = 2  # seconds

        # Initialize Twitter client
        self.client = None
        self.kafka_producer = None

        # Metrics
        self.tweets_processed = 0
        self.errors_count = 0
        self.last_tweet_id = None

    def initialize(self):
        """Initialize Twitter client and Kafka producer"""
        try:
            # Initialize Twitter client
            if not self.bearer_token:
                logger.warning("No Twitter Bearer Token provided. Connector will not start.")
                return False

            self.client = tweepy.Client(
                bearer_token=self.bearer_token,
                wait_on_rate_limit=True
            )

            logger.info("Twitter client initialized successfully")

            # Initialize Kafka producer
            self.kafka_producer = KafkaProducer(
                bootstrap_servers=self.kafka_bootstrap_servers.split(","),
                value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                acks='all',
                retries=3,
                max_in_flight_requests_per_connection=1
            )

            logger.info(f"Kafka producer initialized: {self.kafka_bootstrap_servers}")

            return True

        except Exception as e:
            logger.error(f"Initialization failed: {e}", exc_info=True)
            return False

    def transform_tweet(self, tweet: tweepy.Tweet, includes: Dict = None) -> Dict[str, Any]:
        """
        Transform Twitter API response to standard message format
        """
        # Extract user information
        user_data = {}
        if includes and 'users' in includes:
            user = includes['users'][0] if includes['users'] else {}
            user_data = {
                'username': user.username if hasattr(user, 'username') else 'unknown',
                'user_id': user.id if hasattr(user, 'id') else None,
                'verified': user.verified if hasattr(user, 'verified') else False,
                'followers_count': user.public_metrics.get('followers_count', 0) if hasattr(user, 'public_metrics') else 0
            }

        # Extract metrics
        metrics = tweet.public_metrics if hasattr(tweet, 'public_metrics') else {}

        # Extract location from tweet or user
        location = None
        if hasattr(tweet, 'geo') and tweet.geo:
            location = tweet.geo.get('place_id', None)

        message = {
            'id': str(tweet.id),
            'text': tweet.text,
            'platform': 'twitter',
            'author': user_data.get('username', 'unknown'),
            'author_id': user_data.get('user_id'),
            'verified': user_data.get('verified', False),
            'timestamp': tweet.created_at.isoformat() if hasattr(tweet, 'created_at') else datetime.utcnow().isoformat(),
            'location': location,
            'language': tweet.lang if hasattr(tweet, 'lang') else 'en',
            'metrics': {
                'retweet_count': metrics.get('retweet_count', 0),
                'reply_count': metrics.get('reply_count', 0),
                'like_count': metrics.get('like_count', 0),
                'quote_count': metrics.get('quote_count', 0),
                'impression_count': metrics.get('impression_count', 0)
            },
            'entities': {
                'hashtags': [tag['tag'] for tag in tweet.entities.get('hashtags', [])] if hasattr(tweet, 'entities') else [],
                'mentions': [mention['username'] for mention in tweet.entities.get('mentions', [])] if hasattr(tweet, 'entities') else []
            },
            'source': 'twitter_api_v2',
            'ingestion_timestamp': datetime.utcnow().isoformat()
        }

        return message

    def send_to_kafka(self, message: Dict[str, Any], retry_count: int = 0) -> bool:
        """
        Send message to Kafka with retry logic
        """
        try:
            future = self.kafka_producer.send(self.kafka_topic, value=message)
            future.get(timeout=10)  # Wait for confirmation
            return True

        except KafkaError as e:
            logger.error(f"Kafka error: {e}")

            if retry_count < self.max_retries:
                backoff = self.base_backoff * (2 ** retry_count)
                logger.info(f"Retrying in {backoff} seconds... (attempt {retry_count + 1}/{self.max_retries})")
                time.sleep(backoff)
                return self.send_to_kafka(message, retry_count + 1)

            self.errors_count += 1
            return False

        except Exception as e:
            logger.error(f"Unexpected error sending to Kafka: {e}", exc_info=True)
            self.errors_count += 1
            return False

    def search_recent_tweets(self, query: str, max_results: int = 100) -> Optional[tweepy.Response]:
        """
        Search recent tweets with rate limiting
        """
        # Check rate limiter
        if not self.rate_limiter.is_allowed():
            wait_time = self.rate_limiter.wait_time()
            logger.info(f"Rate limit reached. Waiting {wait_time:.2f} seconds...")
            time.sleep(wait_time)

        try:
            response = self.client.search_recent_tweets(
                query=query,
                max_results=max_results,
                tweet_fields=['created_at', 'public_metrics', 'lang', 'entities', 'geo'],
                user_fields=['username', 'verified', 'public_metrics'],
                expansions=['author_id'],
                since_id=self.last_tweet_id
            )

            return response

        except tweepy.TooManyRequests as e:
            logger.warning("Rate limit exceeded (429). Waiting before retry...")
            time.sleep(60)  # Wait 1 minute
            return None

        except tweepy.Unauthorized as e:
            logger.error("Authentication failed. Check your Bearer Token.")
            return None

        except Exception as e:
            logger.error(f"Error searching tweets: {e}", exc_info=True)
            return None

    def run(self):
        """
        Main run loop - continuously fetch and process tweets
        """
        if not self.initialize():
            logger.error("Failed to initialize. Exiting...")
            return

        logger.info("Starting Twitter connector...")
        logger.info(f"Keywords: {self.keywords}")
        logger.info(f"Languages: {self.languages}")

        # Build search query
        keyword_query = " OR ".join(self.keywords)
        language_query = " OR ".join([f"lang:{lang}" for lang in self.languages])
        query = f"({keyword_query}) ({language_query}) -is:retweet"

        logger.info(f"Search query: {query}")

        while True:
            try:
                # Search tweets
                response = self.search_recent_tweets(query, max_results=100)

                if response and response.data:
                    tweets = response.data
                    includes = response.includes if hasattr(response, 'includes') else None

                    logger.info(f"Fetched {len(tweets)} tweets")

                    # Update last tweet ID for pagination
                    if tweets:
                        self.last_tweet_id = tweets[0].id

                    # Process each tweet
                    for tweet in tweets:
                        try:
                            # Transform tweet to standard format
                            message = self.transform_tweet(tweet, includes)

                            # Send to Kafka
                            if self.send_to_kafka(message):
                                self.tweets_processed += 1

                                if self.tweets_processed % 100 == 0:
                                    logger.info(f"Processed {self.tweets_processed} tweets, {self.errors_count} errors")

                        except Exception as e:
                            logger.error(f"Error processing tweet {tweet.id}: {e}")
                            self.errors_count += 1

                else:
                    logger.info("No new tweets found. Waiting...")

                # Wait before next fetch (to respect rate limits)
                time.sleep(10)

            except KeyboardInterrupt:
                logger.info("Shutting down...")
                break

            except Exception as e:
                logger.error(f"Unexpected error in main loop: {e}", exc_info=True)
                time.sleep(30)

        # Cleanup
        if self.kafka_producer:
            self.kafka_producer.close()

        logger.info(f"Total tweets processed: {self.tweets_processed}")
        logger.info(f"Total errors: {self.errors_count}")


def main():
    """Main entry point"""
    connector = TwitterConnector()
    connector.run()


if __name__ == "__main__":
    main()
