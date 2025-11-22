"""
Synthetic Data Generator for Real-Time Sentiment Analysis
Generates 20K+ realistic messages with metadata when APIs are unavailable
"""

import os
import json
import time
import random
import logging
from typing import List, Dict, Any
from datetime import datetime, timedelta

from kafka import KafkaProducer
from kafka.errors import KafkaError
from faker import Faker
import numpy as np

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

fake = Faker()


class DataGenerator:
    """
    Generates realistic synthetic social media messages
    """

    def __init__(self):
        self.kafka_bootstrap_servers = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
        self.kafka_topic = os.getenv("KAFKA_TOPIC", "sentiment.raw")
        self.total_messages = int(os.getenv("TOTAL_MESSAGES", 20000))
        self.messages_per_second = int(os.getenv("MESSAGES_PER_SECOND", 100))

        # Configuration
        self.cities = os.getenv("CITIES", "Dubai,Abu Dhabi,Sharjah,Ajman").split(",")
        self.products = os.getenv("PRODUCTS", "Credit Card,Personal Loan,Mortgage,Savings Account").split(",")
        self.channels = os.getenv("CHANNELS", "Mobile App,Website,Branch,Call Center").split(",")
        self.platforms = os.getenv("PLATFORMS", "Twitter,Reddit,Instagram,Facebook").split(",")

        self.kafka_producer = None
        self.messages_sent = 0

    def initialize(self):
        """Initialize Kafka producer"""
        try:
            self.kafka_producer = KafkaProducer(
                bootstrap_servers=self.kafka_bootstrap_servers.split(","),
                value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                acks='all',
                retries=3,
                compression_type='gzip'
            )

            logger.info(f"Kafka producer initialized: {self.kafka_bootstrap_servers}")
            return True

        except Exception as e:
            logger.error(f"Failed to initialize Kafka producer: {e}", exc_info=True)
            return False

    def generate_positive_text(self, product: str) -> str:
        """Generate positive sentiment text"""
        templates = [
            f"Love the new {product}! Best decision I've made this year. Highly recommend!",
            f"Excellent service with my {product}. The staff was very helpful and professional.",
            f"Just got approved for my {product}! Super fast process and great rates!",
            f"The {product} from ENBD is amazing. Clean interface and great features.",
            f"So happy with my {product}. Everything works perfectly!",
            f"Outstanding experience! The {product} exceeded my expectations.",
            f"Best {product} I've ever had. Customer service is top-notch!",
            f"Impressed with how easy it was to set up my {product}. Great job!",
            f"Thank you for the excellent {product}! Very satisfied customer here.",
            f"My {product} has made managing my finances so much easier. Love it!",
            f"Fantastic rates on my {product}! Couldn't be happier.",
            f"The mobile app for my {product} is incredibly user-friendly. Well done!",
            f"Just recommended the {product} to my friends. Excellent value!",
            f"Very pleased with the quick approval process for my {product}.",
            f"The rewards program on my {product} is generous. Keep it up!",
        ]
        return random.choice(templates)

    def generate_negative_text(self, product: str) -> str:
        """Generate negative sentiment text"""
        templates = [
            f"Terrible experience with my {product}. Customer service is awful.",
            f"My {product} application was rejected for no reason. Very disappointed.",
            f"The fees on my {product} are ridiculous. Hidden charges everywhere!",
            f"Worst {product} ever. The app keeps crashing and support doesn't help.",
            f"Been waiting for 3 weeks for my {product}. Unacceptable service!",
            f"DO NOT get the {product}. Save yourself the headache.",
            f"Frustrated with the high interest rates on my {product}. Switching banks.",
            f"The {product} is a complete scam. So many hidden fees!",
            f"Customer service for my {product} issue has been horrible. No one helps!",
            f"My {product} was cancelled without notice. This is unacceptable!",
            f"The terms and conditions for the {product} are confusing and misleading.",
            f"Avoid their {product}! Poor service and terrible rates.",
            f"Been on hold for 2 hours trying to resolve my {product} issue. Ridiculous!",
            f"The {product} promised great features but delivers nothing. Disappointed.",
            f"Thinking of closing my {product} account. Too many problems.",
        ]
        return random.choice(templates)

    def generate_neutral_text(self, product: str) -> str:
        """Generate neutral sentiment text"""
        templates = [
            f"Just opened a new {product} account. Let's see how it goes.",
            f"Considering getting a {product}. What are your experiences?",
            f"Anyone have feedback on the {product}? Looking for opinions.",
            f"The {product} has some good features and some not so good ones.",
            f"Applied for a {product} today. Waiting for approval.",
            f"Comparing different {product} options. Help me decide?",
            f"What's the interest rate on the {product} these days?",
            f"Looking into getting a {product}. Need more information first.",
            f"Has anyone tried their {product}? Curious about it.",
            f"The {product} is okay. Nothing special but gets the job done.",
            f"Received my {product} card today. Setting it up now.",
            f"Thinking about upgrading my {product}. Any suggestions?",
            f"The {product} application process is straightforward.",
            f"Anyone know the eligibility criteria for the {product}?",
            f"Just checking the status of my {product} application.",
        ]
        return random.choice(templates)

    def generate_message(self) -> Dict[str, Any]:
        """Generate a single realistic message"""
        # Sentiment distribution: 40% positive, 30% negative, 30% neutral
        sentiment_type = np.random.choice(
            ['positive', 'negative', 'neutral'],
            p=[0.4, 0.3, 0.3]
        )

        # Select random metadata
        product = random.choice(self.products)
        platform = random.choice(self.platforms)
        city = random.choice(self.cities)
        channel = random.choice(self.channels)

        # Generate text based on sentiment
        if sentiment_type == 'positive':
            text = self.generate_positive_text(product)
        elif sentiment_type == 'negative':
            text = self.generate_negative_text(product)
        else:
            text = self.generate_neutral_text(product)

        # Generate realistic timestamp (last 7 days)
        days_ago = random.randint(0, 7)
        hours_ago = random.randint(0, 23)
        minutes_ago = random.randint(0, 59)
        timestamp = datetime.utcnow() - timedelta(days=days_ago, hours=hours_ago, minutes=minutes_ago)

        # Generate realistic metrics based on sentiment
        if sentiment_type == 'positive':
            likes = random.randint(10, 500)
            shares = random.randint(5, 100)
            replies = random.randint(2, 50)
        elif sentiment_type == 'negative':
            likes = random.randint(1, 50)
            shares = random.randint(0, 20)
            replies = random.randint(5, 100)  # Negative posts get more replies
        else:
            likes = random.randint(0, 30)
            shares = random.randint(0, 10)
            replies = random.randint(0, 20)

        # Device used
        devices = ['iOS', 'Android', 'Web', 'Mobile Web', 'Desktop']
        device = random.choice(devices)

        # Generate message
        message = {
            'id': f"synthetic_{fake.uuid4()}",
            'text': text,
            'platform': platform.lower(),
            'author': fake.user_name(),
            'author_id': fake.uuid4(),
            'timestamp': timestamp.isoformat(),
            'location': city,
            'city': city,
            'product': product,
            'channel': channel,
            'device': device,
            'language': 'en',
            'metrics': {
                'likes': likes,
                'shares': shares,
                'replies': replies,
                'impressions': likes * random.randint(10, 50)
            },
            'metadata': {
                'sentiment_hint': sentiment_type,  # For validation purposes
                'is_synthetic': True,
                'generator_version': '1.0'
            },
            'source': 'synthetic_generator',
            'ingestion_timestamp': datetime.utcnow().isoformat()
        }

        return message

    def send_to_kafka(self, message: Dict[str, Any]) -> bool:
        """Send message to Kafka"""
        try:
            future = self.kafka_producer.send(self.kafka_topic, value=message)
            future.get(timeout=10)
            return True

        except KafkaError as e:
            logger.error(f"Kafka error: {e}")
            return False

        except Exception as e:
            logger.error(f"Error sending to Kafka: {e}", exc_info=True)
            return False

    def run(self):
        """Generate and send messages"""
        if not self.initialize():
            logger.error("Failed to initialize. Exiting...")
            return

        logger.info("=" * 60)
        logger.info("Starting Synthetic Data Generator")
        logger.info("=" * 60)
        logger.info(f"Total messages: {self.total_messages}")
        logger.info(f"Messages per second: {self.messages_per_second}")
        logger.info(f"Cities: {self.cities}")
        logger.info(f"Products: {self.products}")
        logger.info(f"Channels: {self.channels}")
        logger.info(f"Platforms: {self.platforms}")
        logger.info("=" * 60)

        start_time = time.time()
        batch_size = self.messages_per_second
        sleep_time = 1.0  # seconds

        try:
            while self.messages_sent < self.total_messages:
                batch_start = time.time()

                # Generate and send batch
                for _ in range(batch_size):
                    if self.messages_sent >= self.total_messages:
                        break

                    message = self.generate_message()

                    if self.send_to_kafka(message):
                        self.messages_sent += 1

                        if self.messages_sent % 1000 == 0:
                            elapsed = time.time() - start_time
                            rate = self.messages_sent / elapsed
                            remaining = self.total_messages - self.messages_sent
                            eta = remaining / rate if rate > 0 else 0

                            logger.info(
                                f"Progress: {self.messages_sent}/{self.total_messages} "
                                f"({self.messages_sent * 100 / self.total_messages:.1f}%) | "
                                f"Rate: {rate:.1f} msg/s | "
                                f"ETA: {eta:.0f}s"
                            )

                # Sleep to maintain desired rate
                batch_elapsed = time.time() - batch_start
                if batch_elapsed < sleep_time:
                    time.sleep(sleep_time - batch_elapsed)

        except KeyboardInterrupt:
            logger.info("Interrupted by user")

        except Exception as e:
            logger.error(f"Error in generation loop: {e}", exc_info=True)

        finally:
            # Cleanup
            if self.kafka_producer:
                self.kafka_producer.flush()
                self.kafka_producer.close()

            total_time = time.time() - start_time
            logger.info("=" * 60)
            logger.info(f"Generation complete!")
            logger.info(f"Total messages sent: {self.messages_sent}")
            logger.info(f"Total time: {total_time:.2f}s")
            logger.info(f"Average rate: {self.messages_sent / total_time:.1f} msg/s")
            logger.info("=" * 60)


def main():
    """Main entry point"""
    generator = DataGenerator()
    generator.run()


if __name__ == "__main__":
    main()
