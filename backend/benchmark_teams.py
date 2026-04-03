import time
import requests
import json
import statistics

API_URL = "http://localhost:8000/api/teams/my"
# API_URL = "https://fleemy.onrender.com/api/teams/my" # Use this for production test
TEST_TOKEN = "test-token-123"
HEADERS = {
    "Authorization": f"Bearer {TEST_TOKEN}",
    "Content-Type": "application/json"
}

def benchmark(n=5):
    print(f"🚀 Starting benchmark of {n} requests to {API_URL}...")
    latencies = []
    
    for i in range(1, n + 1):
        start = time.perf_counter()
        try:
            response = requests.get(API_URL, headers=HEADERS, timeout=10)
            end = time.perf_counter()
            latency = (end - start) * 1000
            latencies.append(latency)
            
            status = response.status_code
            success = response.json().get("success", False)
            source = "CACHE" if "memory cache" in str(response.text) else "FIRESTORE" # This is a placeholder for logic
            
            print(f"Request {i}: {latency:.2f}ms (Status: {status}, Success: {success})")
        except Exception as e:
            print(f"Request {i}: FAILED ({e})")
            
    if latencies:
        print("\n--- RESULTS ---")
        print(f"Min: {min(latencies):.2f}ms")
        print(f"Max: {max(latencies):.2f}ms")
        print(f"Mean: {statistics.mean(latencies):.2f}ms")
        if len(latencies) > 1:
            print(f"Median: {statistics.median(latencies):.2f}ms")
            print(f"First request: {latencies[0]:.2f}ms")
            print(f"Subsequent avg: {statistics.mean(latencies[1:]):.2f}ms")
            improvement = (latencies[0] - statistics.mean(latencies[1:])) / latencies[0] * 100
            print(f"Cache Speedup: {improvement:.1f}%")

if __name__ == "__main__":
    benchmark(10)
