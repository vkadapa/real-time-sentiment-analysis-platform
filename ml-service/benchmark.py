"""
Benchmark script for ML Service
Tests inference latency and throughput
"""

import time
import asyncio
import statistics
from typing import List
import aiohttp


async def benchmark_single_inference(url: str, text: str, iterations: int = 100) -> List[float]:
    """Benchmark single inference requests"""
    latencies = []

    async with aiohttp.ClientSession() as session:
        for i in range(iterations):
            start = time.time()

            async with session.post(
                f"{url}/analyze",
                json={
                    "text": text,
                    "include_emotion": True,
                    "include_toxicity": True
                }
            ) as response:
                await response.json()

            latency = (time.time() - start) * 1000  # ms
            latencies.append(latency)

            if (i + 1) % 10 == 0:
                print(f"Completed {i + 1}/{iterations} requests")

    return latencies


async def benchmark_batch_inference(url: str, texts: List[str], iterations: int = 50) -> List[float]:
    """Benchmark batch inference requests"""
    latencies = []

    async with aiohttp.ClientSession() as session:
        for i in range(iterations):
            start = time.time()

            async with session.post(
                f"{url}/analyze/batch",
                json={
                    "texts": texts,
                    "include_emotion": True,
                    "include_toxicity": True
                }
            ) as response:
                await response.json()

            latency = (time.time() - start) * 1000  # ms
            latencies.append(latency)

            if (i + 1) % 10 == 0:
                print(f"Completed {i + 1}/{iterations} batch requests")

    return latencies


def print_statistics(latencies: List[float], label: str):
    """Print latency statistics"""
    print(f"\n{label}:")
    print(f"  Mean: {statistics.mean(latencies):.2f} ms")
    print(f"  Median: {statistics.median(latencies):.2f} ms")
    print(f"  Min: {min(latencies):.2f} ms")
    print(f"  Max: {max(latencies):.2f} ms")
    print(f"  Std Dev: {statistics.stdev(latencies):.2f} ms")
    print(f"  P95: {statistics.quantiles(latencies, n=20)[18]:.2f} ms")
    print(f"  P99: {statistics.quantiles(latencies, n=100)[98]:.2f} ms")


async def main():
    url = "http://localhost:8000"

    # Test texts
    single_text = "I love the new mobile banking app! It's so easy to use and the interface is beautiful."
    batch_texts = [
        "This bank has terrible customer service. I'm switching to another bank.",
        "Great experience with the loan officer. Very helpful and professional.",
        "The ATM ate my card and nobody is answering the phone!",
        "Impressed with the quick approval process for my mortgage.",
        "Why does the app keep crashing? This is so frustrating!",
        "Love the cashback rewards on my credit card!",
        "Waiting for 2 hours at the branch. Unacceptable service.",
        "The investment advisor helped me plan my retirement perfectly.",
        "Hidden fees everywhere. Not transparent at all.",
        "Best banking experience I've ever had. Highly recommend!"
    ]

    print("=" * 60)
    print("ML Service Benchmark")
    print("=" * 60)

    # Benchmark single inference
    print("\nRunning single inference benchmark...")
    single_latencies = await benchmark_single_inference(url, single_text, iterations=100)
    print_statistics(single_latencies, "Single Inference")

    # Benchmark batch inference
    print("\nRunning batch inference benchmark...")
    batch_latencies = await benchmark_batch_inference(url, batch_texts, iterations=50)
    print_statistics(batch_latencies, "Batch Inference (10 texts)")

    # Calculate throughput
    single_throughput = 1000 / statistics.mean(single_latencies)
    batch_throughput = (len(batch_texts) * 1000) / statistics.mean(batch_latencies)

    print("\n" + "=" * 60)
    print("Throughput:")
    print(f"  Single: {single_throughput:.2f} requests/second")
    print(f"  Batch: {batch_throughput:.2f} texts/second")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
