#!/bin/bash

# Payment Management System Test Runner
# This script runs all payment-related tests across the application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to run backend tests
run_backend_tests() {
    print_status "Running Backend Payment System Tests..."

    if [ ! -d "backend" ]; then
        print_error "Backend directory not found. Please run from project root."
        return 1
    fi

    cd backend

    # Check if Python is available
    if ! command_exists python3 && ! command_exists python; then
        print_error "Python is not installed or not in PATH"
        return 1
    fi

    # Use python3 if available, otherwise use python
    PYTHON_CMD="python3"
    if ! command_exists python3; then
        PYTHON_CMD="python"
    fi

    # Check if pytest is installed
    if ! $PYTHON_CMD -c "import pytest" 2>/dev/null; then
        print_warning "pytest not found. Installing..."
        $PYTHON_CMD -m pip install pytest pytest-asyncio pytest-cov
    fi

    # Check if test file exists
    if [ ! -f "tests/test_payment_system.py" ]; then
        print_error "Payment system test file not found: tests/test_payment_system.py"
        cd ..
        return 1
    fi

    # Run the tests
    print_status "Executing payment system tests..."
    if $PYTHON_CMD -m pytest tests/test_payment_system.py -v --tb=short; then
        print_success "Backend payment tests completed successfully!"
    else
        print_error "Backend payment tests failed!"
        cd ..
        return 1
    fi

    cd ..
}

# Function to run frontend tests
run_frontend_tests() {
    print_status "Running Frontend Payment Component Tests..."

    # Check if Node.js and npm are available
    if ! command_exists node; then
        print_error "Node.js is not installed or not in PATH"
        return 1
    fi

    if ! command_exists npm; then
        print_error "npm is not installed or not in PATH"
        return 1
    fi

    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Please run from project root."
        return 1
    fi

    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        print_status "Installing dependencies..."
        npm install
    fi

    # Check if test files exist
    PAYMENT_TEST_FILES=(
        "src/test/components/payments/PaymentForm.test.tsx"
        "src/test/components/payments/PaymentList.test.tsx"
        "src/test/components/payments/BulkImportModal.test.tsx"
        "src/test/components/payments/PaymentDashboard.test.tsx"
    )

    for test_file in "${PAYMENT_TEST_FILES[@]}"; do
        if [ ! -f "$test_file" ]; then
            print_error "Payment test file not found: $test_file"
            return 1
        fi
    done

    # Run component tests
    print_status "Running payment component tests..."
    if npm run test src/test/components/payments/ --run; then
        print_success "Payment component tests completed successfully!"
    else
        print_error "Payment component tests failed!"
        return 1
    fi
}

# Function to run integration tests
run_integration_tests() {
    print_status "Running Payment Integration Tests..."

    # Check if integration test file exists
    if [ ! -f "src/test/integration/payment-workflows.test.tsx" ]; then
        print_error "Payment integration test file not found: src/test/integration/payment-workflows.test.tsx"
        return 1
    fi

    print_status "Running payment workflow integration tests..."
    if npm run test src/test/integration/payment-workflows.test.tsx --run; then
        print_success "Payment integration tests completed successfully!"
    else
        print_error "Payment integration tests failed!"
        return 1
    fi
}

# Function to run API client tests
run_api_tests() {
    print_status "Running Payment API Client Tests..."

    # Check if API test file exists
    if [ ! -f "src/test/api/payment-client.test.ts" ]; then
        print_error "Payment API test file not found: src/test/api/payment-client.test.ts"
        return 1
    fi

    print_status "Running payment API client tests..."
    if npm run test src/test/api/payment-client.test.ts --run; then
        print_success "Payment API client tests completed successfully!"
    else
        print_error "Payment API client tests failed!"
        return 1
    fi
}

# Function to run all tests with coverage
run_coverage_tests() {
    print_status "Running Payment Tests with Coverage..."

    # Backend coverage
    print_status "Running backend tests with coverage..."
    cd backend
    if command_exists python3; then
        PYTHON_CMD="python3"
    else
        PYTHON_CMD="python"
    fi

    $PYTHON_CMD -m pytest tests/test_payment_system.py --cov=app/routers/payments --cov=app/models/payment --cov-report=html --cov-report=term
    cd ..

    # Frontend coverage
    print_status "Running frontend tests with coverage..."
    npm run test src/test/components/payments/ src/test/integration/payment-workflows.test.tsx src/test/api/payment-client.test.ts --coverage --run
}

# Function to display help
show_help() {
    echo "Payment Management System Test Runner"
    echo ""
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  -a, --all           Run all payment tests (default)"
    echo "  -b, --backend       Run backend payment system tests only"
    echo "  -f, --frontend      Run frontend payment component tests only"
    echo "  -i, --integration   Run payment integration tests only"
    echo "  -c, --api-client    Run payment API client tests only"
    echo "  -o, --coverage      Run all tests with coverage reports"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                  # Run all payment tests"
    echo "  $0 --backend        # Run only backend tests"
    echo "  $0 --coverage       # Run all tests with coverage"
    echo ""
}

# Main execution
main() {
    print_status "Payment Management System Test Runner"
    print_status "======================================"

    case "${1:-all}" in
        -b|--backend)
            run_backend_tests
            ;;
        -f|--frontend)
            run_frontend_tests
            ;;
        -i|--integration)
            run_integration_tests
            ;;
        -c|--api-client)
            run_api_tests
            ;;
        -o|--coverage)
            run_coverage_tests
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        -a|--all|all|"")
            print_status "Running complete payment test suite..."

            # Run all test categories
            if run_backend_tests && run_frontend_tests && run_integration_tests && run_api_tests; then
                print_success "All payment tests completed successfully! 🎉"
                print_status "Test Summary:"
                print_success "✅ Backend API tests - PASSED"
                print_success "✅ Frontend component tests - PASSED"
                print_success "✅ Integration workflow tests - PASSED"
                print_success "✅ API client tests - PASSED"
                exit 0
            else
                print_error "Some payment tests failed! ❌"
                print_error "Please check the output above for details."
                exit 1
            fi
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
}

# Check if we're in the project root
if [ ! -f "package.json" ] && [ ! -d "backend" ]; then
    print_error "Please run this script from the project root directory."
    exit 1
fi

# Run main function with all arguments
main "$@"