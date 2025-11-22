"""
Reddit Connector for Real-Time Sentiment Analysis
Uses Reddit API (PRAW) with OAuth
Implements rate limiting, retry logic, and Kafka integration
"""

import os
import json
import time
import logging
from typing import Optional, Dict, Any, List, Set
from datetime import datetime
from collections import deque

import praw
from praw.exceptions import RedditAPIException, PRAWException
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
        now = time.time() * 1000
        window_start = now - self.window_ms

        while self.requests and self.requests[0] < window_start:
            self.requests.popleft()

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


class RedditConnector:
    """
    Reddit API Connector with rate limiting and Kafka integration
    """

    def __init__(self):
        self.client_id = os.getenv("REDDIT_CLIENT_ID")
        self.client_secret = os.getenv("REDDIT_CLIENT_SECRET")
        self.user_agent = os.getenv("REDDIT_USER_AGENT", "ENBDSentimentBot/1.0")

        self.kafka_bootstrap_servers = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
        self.kafka_topic = os.getenv("KAFKA_TOPIC", "sentiment.raw")

        # Reddit configuration
        self.subreddits = os.getenv("REDDIT_SUBREDDITS", "personalfinance,banking").split(",")
        self.keywords = os.getenv("REDDIT_KEYWORDS", "bank,credit,loan").split(",")

        # Rate limiting (Reddit allows 60 requests per minute)
        self.rate_limiter = RateLimiter(max_requests=50, window_ms=60000)

        # Retry configuration
        self.max_retries = 3
        self.base_backoff = 2

        # Initialize clients
        self.reddit = None
        self.kafka_producer = None

        # Track processed items
        self.processed_ids: Set[str] = set()

        # Metrics
        self.posts_processed = 0
        self.comments_processed = 0
        self.errors_count = 0

    def initialize(self):
        """Initialize Reddit client and Kafka producer"""
        try:
            # Initialize Reddit client
            if not self.client_id or not self.client_secret:
                logger.warning("No Reddit credentials provided. Connector will not start.")
                return False

            self.reddit = praw.Reddit(
                client_id=self.client_id,
                client_secret=self.client_secret,
                user_agent=self.user_agent
            )

            # Test authentication
            logger.info(f"Reddit client initialized. Read-only: {self.reddit.read_only}")

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

    def transform_submission(self, submission: praw.models.Submission) -> Dict[str, Any]:
        """
        Transform Reddit submission to standard message format
        """
        message = {
            'id': f"reddit_post_{submission.id}",
            'text': f"{submission.title}\n\n{submission.selftext}" if submission.selftext else submission.title,
            'platform': 'reddit',
            'content_type': 'post',
            'author': str(submission.author) if submission.author else '[deleted]',
            'author_id': submission.author.id if submission.author else None,
            'timestamp': datetime.fromtimestamp(submission.created_utc).isoformat(),
            'subreddit': submission.subreddit.display_name,
            'url': f"https://reddit.com{submission.permalink}",
            'metrics': {
                'score': submission.score,
                'upvote_ratio': submission.upvote_ratio,
                'num_comments': submission.num_comments,
                'awards': submission.total_awards_received
            },
            'entities': {
                'flair': submission.link_flair_text if submission.link_flair_text else None
            },
            'source': 'reddit_api',
            'ingestion_timestamp': datetime.utcnow().isoformat()
        }

        return message

    def transform_comment(self, comment: praw.models.Comment, submission: praw.models.Submission) -> Dict[str, Any]:
        """
        Transform Reddit comment to standard message format
        """
        message = {
            'id': f"reddit_comment_{comment.id}",
            'text': comment.body,
            'platform': 'reddit',
            'content_type': 'comment',
            'author': str(comment.author) if comment.author else '[deleted]',
            'author_id': comment.author.id if comment.author else None,
            'timestamp': datetime.fromtimestamp(comment.created_utc).isoformat(),
            'subreddit': comment.subreddit.display_name,
            'parent_post_id': submission.id,
            'url': f"https://reddit.com{comment.permalink}",
            'metrics': {
                'score': comment.score,
                'awards': comment.total_awards_received,
                'is_submitter': comment.is_submitter
            },
            'source': 'reddit_api',
            'ingestion_timestamp': datetime.utcnow().isoformat()
        }

        return message

    def send_to_kafka(self, message: Dict[str, Any], retry_count: int = 0) -> bool:
        """
        Send message to Kafka with retry logic
        """
        try:
            future = self.kafka_producer.send(self.kafka_topic, value=message)
            future.get(timeout=10)
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

    def contains_keywords(self, text: str) -> bool:
        """Check if text contains any of the configured keywords"""
        text_lower = text.lower()
        return any(keyword.lower() in text_lower for keyword in self.keywords)

    def process_submission(self, submission: praw.models.Submission):
        """Process a Reddit submission (post)"""
        try:
            # Check if already processed
            if submission.id in self.processed_ids:
                return

            # Check rate limiter
            if not self.rate_limiter.is_allowed():
                wait_time = self.rate_limiter.wait_time()
                time.sleep(wait_time)

            # Transform submission
            message = self.transform_submission(submission)

            # Check if contains keywords
            if self.contains_keywords(message['text']):
                # Send to Kafka
                if self.send_to_kafka(message):
                    self.posts_processed += 1
                    self.processed_ids.add(submission.id)

                    if self.posts_processed % 50 == 0:
                        logger.info(f"Processed {self.posts_processed} posts, {self.comments_processed} comments")

                # Process top comments
                submission.comments.replace_more(limit=0)  # Remove "load more" comments
                for comment in submission.comments.list()[:10]:  # Top 10 comments
                    self.process_comment(comment, submission)

        except Exception as e:
            logger.error(f"Error processing submission {submission.id}: {e}")
            self.errors_count += 1

    def process_comment(self, comment: praw.models.Comment, submission: praw.models.Submission):
        """Process a Reddit comment"""
        try:
            # Check if already processed
            if comment.id in self.processed_ids:
                return

            # Skip deleted/removed comments
            if not comment.body or comment.body in ['[deleted]', '[removed]']:
                return

            # Check rate limiter
            if not self.rate_limiter.is_allowed():
                wait_time = self.rate_limiter.wait_time()
                time.sleep(wait_time)

            # Transform comment
            message = self.transform_comment(comment, submission)

            # Check if contains keywords
            if self.contains_keywords(message['text']):
                # Send to Kafka
                if self.send_to_kafka(message):
                    self.comments_processed += 1
                    self.processed_ids.add(comment.id)

        except Exception as e:
            logger.error(f"Error processing comment {comment.id}: {e}")
            self.errors_count += 1

    def run(self):
        """
        Main run loop - continuously fetch and process Reddit posts
        """
        if not self.initialize():
            logger.error("Failed to initialize. Exiting...")
            return

        logger.info("Starting Reddit connector...")
        logger.info(f"Subreddits: {self.subreddits}")
        logger.info(f"Keywords: {self.keywords}")

        while True:
            try:
                for subreddit_name in self.subreddits:
                    try:
                        logger.info(f"Fetching from r/{subreddit_name}...")

                        subreddit = self.reddit.subreddit(subreddit_name)

                        # Fetch new posts
                        for submission in subreddit.new(limit=25):
                            self.process_submission(submission)

                        # Fetch hot posts
                        for submission in subreddit.hot(limit=25):
                            self.process_submission(submission)

                    except RedditAPIException as e:
                        logger.error(f"Reddit API error for r/{subreddit_name}: {e}")
                        time.sleep(60)

                    except Exception as e:
                        logger.error(f"Error processing r/{subreddit_name}: {e}", exc_info=True)

                # Wait before next cycle
                logger.info("Waiting before next fetch cycle...")
                time.sleep(30)

                # Clean up old processed IDs (keep last 10k)
                if len(self.processed_ids) > 10000:
                    # Convert to list, remove first half, convert back
                    ids_list = list(self.processed_ids)
                    self.processed_ids = set(ids_list[5000:])

            except KeyboardInterrupt:
                logger.info("Shutting down...")
                break

            except Exception as e:
                logger.error(f"Unexpected error in main loop: {e}", exc_info=True)
                time.sleep(30)

        # Cleanup
        if self.kafka_producer:
            self.kafka_producer.close()

        logger.info(f"Total posts processed: {self.posts_processed}")
        logger.info(f"Total comments processed: {self.comments_processed}")
        logger.info(f"Total errors: {self.errors_count}")


def main():
    """Main entry point"""
    connector = RedditConnector()
    connector.run()


if __name__ == "__main__":
    main()
