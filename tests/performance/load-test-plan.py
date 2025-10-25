"""
Performance and Load Testing Plan for Payment System.
Tests system performance under various load conditions.
"""

import asyncio
import aiohttp
import time
import statistics
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Any
import json
import random


class PaymentLoadTester:
    """Load testing utility for payment system."""

    def __init__(self, base_url: str = "http://127.0.0.1:8000"):
        self.base_url = base_url
        self.results = []
        self.session = None

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    def generate_test_payment_data(self, payment_method: str = None) -> Dict[str, Any]:
        """Generate realistic test payment data."""
        payment_methods = ["cash", "check", "bank_transfer", "mobile_payment", "online_payment"]
        method = payment_method or random.choice(payment_methods)

        base_data = {
            "student_id": f"student_{random.randint(1, 1000)}",
            "fee_id": random.choice(["tuition", "exam_fee", "library_fee", "lab_fee"]),
            "amount": random.randint(500, 10000),
            "payment_method": method,
            "payment_date": "2024-01-15",
            "notes": f"Test payment {random.randint(1000, 9999)}"
        }

        # Add method-specific details
        if method == "bank_transfer":
            base_data["bank_details"] = {
                "bank_name": random.choice([
                    "Commercial Bank of Ethiopia",
                    "Dashen Bank",
                    "Awash Bank",
                    "Wegagen Bank"
                ]),
                "transaction_number": f"TXN{random.randint(100000000, 999999999)}",
                "bank_code": f"{random.randint(1, 999):03d}"
            }
        elif method in ["mobile_payment", "online_payment"]:
            base_data["mobile_details"] = {
                "transaction_id": f"{method.upper()}{random.randint(100000000, 999999999)}"
            }

        return base_data

    async def create_payment(self, payment_data: Dict[str, Any], auth_token: str) -> Dict[str, Any]:
        """Create a single payment and measure response time."""
        start_time = time.time()

        try:
            headers = {"Authorization": f"Bearer {auth_token}"}
            async with self.session.post(
                f"{self.base_url}/api/payments/extended",
                json=payment_data,
                headers=headers
            ) as response:
                response_time = time.time() - start_time

                result = {
                    "status_code": response.status,
                    "response_time": response_time,
                    "success": response.status == 201,
                    "payment_method": payment_data["payment_method"]
                }

                if response.status == 201:
                    result["payment_id"] = (await response.json()).get("id")
                else:
                    result["error"] = await response.text()

                return result

        except Exception as e:
            return {
                "status_code": 0,
                "response_time": time.time() - start_time,
                "success": False,
                "error": str(e),
                "payment_method": payment_data["payment_method"]
            }

    async def run_concurrent_payments(
        self,
        num_concurrent: int,
        total_requests: int,
        auth_token: str,
        payment_method: str = None
    ) -> List[Dict[str, Any]]:
        """Run concurrent payment creation requests."""
        tasks = []

        for _ in range(total_requests):
            payment_data = self.generate_test_payment_data(payment_method)
            task = self.create_payment(payment_data, auth_token)
            tasks.append(task)

        # Execute tasks in batches to control concurrency
        results = []
        for i in range(0, len(tasks), num_concurrent):
            batch = tasks[i:i + num_concurrent]
            batch_results = await asyncio.gather(*batch, return_exceptions=True)

            for result in batch_results:
                if isinstance(result, Exception):
                    results.append({
                        "success": False,
                        "error": str(result),
                        "response_time": 0,
                        "status_code": 0
                    })
                else:
                    results.append(result)

            # Small delay between batches to avoid overwhelming the server
            if i + num_concurrent < len(tasks):
                await asyncio.sleep(0.1)

        return results

    def analyze_results(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze load test results."""
        successful_results = [r for r in results if r["success"]]
        failed_results = [r for r in results if not r["success"]]

        if not successful_results:
            return {
                "total_requests": len(results),
                "successful_requests": 0,
                "failed_requests": len(failed_results),
                "success_rate": 0,
                "error_rate": 100,
                "common_errors": self._analyze_errors(failed_results)
            }

        response_times = [r["response_time"] for r in successful_results]

        # Analyze performance by payment method
        performance_by_method = {}
        for result in successful_results:
            method = result["payment_method"]
            if method not in performance_by_method:
                performance_by_method[method] = []
            performance_by_method[method].append(result["response_time"])

        return {
            "total_requests": len(results),
            "successful_requests": len(successful_results),
            "failed_requests": len(failed_results),
            "success_rate": (len(successful_results) / len(results)) * 100,
            "error_rate": (len(failed_results) / len(results)) * 100,
            "response_time": {
                "min": min(response_times),
                "max": max(response_times),
                "mean": statistics.mean(response_times),
                "median": statistics.median(response_times),
                "p95": statistics.quantiles(response_times, n=20)[18] if len(response_times) > 20 else max(response_times),
                "p99": statistics.quantiles(response_times, n=100)[98] if len(response_times) > 100 else max(response_times)
            },
            "performance_by_method": {
                method: {
                    "count": len(times),
                    "avg_response_time": statistics.mean(times),
                    "min_response_time": min(times),
                    "max_response_time": max(times)
                }
                for method, times in performance_by_method.items()
            },
            "common_errors": self._analyze_errors(failed_results)
        }

    def _analyze_errors(self, failed_results: List[Dict[str, Any]]) -> Dict[str, int]:
        """Analyze common errors from failed requests."""
        error_counts = {}
        for result in failed_results:
            error_msg = result.get("error", "Unknown error")
            status_code = result.get("status_code", 0)
            error_key = f"HTTP {status_code}: {error_msg[:50]}"
            error_counts[error_key] = error_counts.get(error_key, 0) + 1
        return dict(sorted(error_counts.items(), key=lambda x: x[1], reverse=True))


class LoadTestScenarios:
    """Predefined load test scenarios for the payment system."""

    @staticmethod
    async def baseline_test(auth_token: str):
        """Baseline performance test with low load."""
        print("🔍 Running baseline load test...")

        async with PaymentLoadTester() as tester:
            results = await tester.run_concurrent_payments(
                num_concurrent=2,
                total_requests=20,
                auth_token=auth_token
            )

            analysis = tester.analyze_results(results)
            print(f"✅ Baseline test completed: {analysis['success_rate']:.1f}% success rate")
            print(f"📊 Average response time: {analysis['response_time']['mean']:.3f}s")

            return analysis

    @staticmethod
    async def moderate_load_test(auth_token: str):
        """Moderate load test with multiple concurrent users."""
        print("🔍 Running moderate load test...")

        async with PaymentLoadTester() as tester:
            results = await tester.run_concurrent_payments(
                num_concurrent=10,
                total_requests=100,
                auth_token=auth_token
            )

            analysis = tester.analyze_results(results)
            print(f"✅ Moderate load test completed: {analysis['success_rate']:.1f}% success rate")
            print(f"📊 Average response time: {analysis['response_time']['mean']:.3f}s")
            print(f"📊 95th percentile: {analysis['response_time']['p95']:.3f}s")

            return analysis

    @staticmethod
    async def high_load_test(auth_token: str):
        """High load test with many concurrent users."""
        print("🔍 Running high load test...")

        async with PaymentLoadTester() as tester:
            results = await tester.run_concurrent_payments(
                num_concurrent=25,
                total_requests=200,
                auth_token=auth_token
            )

            analysis = tester.analyze_results(results)
            print(f"✅ High load test completed: {analysis['success_rate']:.1f}% success rate")
            print(f"📊 Average response time: {analysis['response_time']['mean']:.3f}s")
            print(f"📊 99th percentile: {analysis['response_time']['p99']:.3f}s")

            return analysis

    @staticmethod
    async def stress_test(auth_token: str):
        """Stress test to find breaking point."""
        print("🔍 Running stress test...")

        async with PaymentLoadTester() as tester:
            # Gradually increase load
            test_stages = [
                (10, 50),   # 10 concurrent, 50 total
                (20, 100),  # 20 concurrent, 100 total
                (30, 150),  # 30 concurrent, 150 total
                (50, 250),  # 50 concurrent, 250 total
            ]

            stage_results = []

            for concurrent, total in test_stages:
                print(f"  📍 Testing {concurrent} concurrent users, {total} total requests...")

                results = await tester.run_concurrent_payments(
                    num_concurrent=concurrent,
                    total_requests=total,
                    auth_token=auth_token
                )

                analysis = tester.analyze_results(results)
                stage_results.append({
                    "concurrent_users": concurrent,
                    "total_requests": total,
                    "analysis": analysis
                })

                print(f"    ✅ Success rate: {analysis['success_rate']:.1f}%")
                print(f"    📊 Avg response time: {analysis['response_time']['mean']:.3f}s")

                # Stop if success rate drops below 80%
                if analysis['success_rate'] < 80:
                    print(f"    ⚠️  Success rate below 80%, stopping stress test")
                    break

                # Wait between stages
                await asyncio.sleep(2)

            return stage_results

    @staticmethod
    async def payment_method_performance_test(auth_token: str):
        """Test performance of different payment methods."""
        print("🔍 Running payment method performance test...")

        payment_methods = ["bank_transfer", "mobile_payment", "online_payment", "cash", "check"]
        method_results = {}

        for method in payment_methods:
            print(f"  📍 Testing {method} payments...")

            async with PaymentLoadTester() as tester:
                results = await tester.run_concurrent_payments(
                    num_concurrent=5,
                    total_requests=30,
                    auth_token=auth_token,
                    payment_method=method
                )

                analysis = tester.analyze_results(results)
                method_results[method] = analysis

                print(f"    ✅ Success rate: {analysis['success_rate']:.1f}%")
                print(f"    📊 Avg response time: {analysis['response_time']['mean']:.3f}s")

        return method_results


async def run_all_performance_tests():
    """Run complete performance test suite."""
    print("🚀 Starting Payment System Performance Tests")
    print("=" * 60)

    # Note: In a real scenario, you'd get a valid auth token
    # For demo purposes, we'll use a mock token
    auth_token = "mock_test_token_for_performance_testing"

    test_results = {}

    try:
        # Run all test scenarios
        test_results["baseline"] = await LoadTestScenarios.baseline_test(auth_token)
        print()

        test_results["moderate_load"] = await LoadTestScenarios.moderate_load_test(auth_token)
        print()

        test_results["high_load"] = await LoadTestScenarios.high_load_test(auth_token)
        print()

        test_results["stress_test"] = await LoadTestScenarios.stress_test(auth_token)
        print()

        test_results["payment_methods"] = await LoadTestScenarios.payment_method_performance_test(auth_token)

    except Exception as e:
        print(f"❌ Performance test failed: {e}")
        return

    # Generate performance report
    print("=" * 60)
    print("📊 PERFORMANCE TEST SUMMARY")
    print("=" * 60)

    for test_name, results in test_results.items():
        if test_name == "stress_test":
            print(f"\n🔥 Stress Test Results:")
            for stage in results:
                concurrent = stage["concurrent_users"]
                analysis = stage["analysis"]
                print(f"  {concurrent} concurrent: {analysis['success_rate']:.1f}% success, "
                      f"{analysis['response_time']['mean']:.3f}s avg response")

        elif test_name == "payment_methods":
            print(f"\n💳 Payment Method Performance:")
            for method, analysis in results.items():
                avg_time = analysis['response_time']['mean'] if analysis['successful_requests'] > 0 else 0
                success_rate = analysis['success_rate']
                print(f"  {method}: {success_rate:.1f}% success, {avg_time:.3f}s avg response")

        else:
            analysis = results
            print(f"\n📈 {test_name.replace('_', ' ').title()}:")
            print(f"  Success Rate: {analysis['success_rate']:.1f}%")
            print(f"  Avg Response Time: {analysis['response_time']['mean']:.3f}s")
            if 'p95' in analysis['response_time']:
                print(f"  95th Percentile: {analysis['response_time']['p95']:.3f}s")

    # Performance recommendations
    print(f"\n💡 PERFORMANCE RECOMMENDATIONS:")

    # Check response times
    baseline_avg = test_results["baseline"]["response_time"]["mean"]
    if baseline_avg > 0.5:
        print("  ⚠️  Consider optimizing baseline response time (currently > 500ms)")

    # Check success rates
    moderate_success = test_results["moderate_load"]["success_rate"]
    if moderate_success < 95:
        print("  ⚠️  Consider scaling backend services (moderate load success rate < 95%)")

    # Check payment method performance
    method_performance = test_results["payment_methods"]
    slow_methods = [m for m, r in method_performance.items()
                   if r["successful_requests"] > 0 and r["response_time"]["mean"] > 1.0]
    if slow_methods:
        print(f"  ⚠️  Consider optimizing {', '.join(slow_methods)} payment methods (slow response times)")

    print("\n✅ Performance testing completed!")


if __name__ == "__main__":
    """
    To run performance tests:

    1. Ensure backend server is running: uvicorn app.main:app --reload
    2. Install dependencies: pip install aiohttp statistics
    3. Run this script: python tests/performance/load-test-plan.py

    Note: Update auth_token with a valid token for your test environment
    """

    asyncio.run(run_all_performance_tests())