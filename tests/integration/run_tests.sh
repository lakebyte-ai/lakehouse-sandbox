#!/bin/bash
# Lakehouse Sandbox Integration Test Runner
# Simple shell wrapper for the Python test runner

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
LAKEHOUSE_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🚀 Lakehouse Sandbox Integration Test Runner${NC}"
echo -e "${CYAN}================================================${NC}"
echo -e "📂 Lakehouse Root: ${LAKEHOUSE_ROOT}"
echo -e "🐍 Python Test Runner: ${SCRIPT_DIR}/test_runner.py"
echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Error: python3 is required but not installed${NC}"
    exit 1
fi

# Check if required packages are available
if ! python3 -c "import requests" &> /dev/null; then
    echo -e "${YELLOW}⚠️  Installing required Python packages...${NC}"
    pip3 install -r "${SCRIPT_DIR}/requirements.txt" --quiet
fi

# Change to lakehouse root directory
cd "$LAKEHOUSE_ROOT"

# Default arguments
ARGS=()
OUTPUT_FILE=""
VERBOSE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            ARGS+=("--verbose")
            shift
            ;;
        -o|--output)
            OUTPUT_FILE="$2"
            ARGS+=("--output" "$2")
            shift 2
            ;;
        -t|--timeout)
            ARGS+=("--timeout" "$2")
            shift 2
            ;;
        --groups)
            ARGS+=("--groups")
            shift
            while [[ $# -gt 0 && ! $1 =~ ^- ]]; do
                ARGS+=("$1")
                shift
            done
            ;;
        -h|--help)
            python3 "${SCRIPT_DIR}/test_runner.py" --help
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            echo -e "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Run the tests
echo -e "${BLUE}🧪 Starting integration tests...${NC}"
echo ""

if python3 "${SCRIPT_DIR}/test_runner.py" "${ARGS[@]}"; then
    echo ""
    echo -e "${GREEN}✅ Integration tests completed successfully!${NC}"
    
    if [[ -n "$OUTPUT_FILE" ]]; then
        echo -e "${CYAN}📄 Detailed report saved to: ${OUTPUT_FILE}${NC}"
    fi
    
    echo ""
    echo -e "${CYAN}🔗 Quick Access URLs:${NC}"
    echo -e "  • WebUI:       http://localhost:3000"
    echo -e "  • Airflow:     http://localhost:8090 (admin/admin)"
    echo -e "  • Kafka UI:    http://localhost:8091"
    echo -e "  • Trino:       http://localhost:8080"
    echo -e "  • MinIO:       http://localhost:9001 (admin/password)"
    echo -e "  • Spark:       http://localhost:8888"
    echo -e "  • Nimtable:    http://localhost:13000 (admin/admin)"
    
    exit 0
else
    echo ""
    echo -e "${RED}❌ Some integration tests failed!${NC}"
    echo -e "${YELLOW}💡 Check the output above for details${NC}"
    
    if [[ -n "$OUTPUT_FILE" ]]; then
        echo -e "${CYAN}📄 Detailed report saved to: ${OUTPUT_FILE}${NC}"
    fi
    
    exit 1
fi