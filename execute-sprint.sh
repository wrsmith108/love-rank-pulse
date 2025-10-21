#!/bin/bash

# Love Rank Pulse - Sprint Execution Script
# Uses Claude Flow parallel agents to complete implementation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if claude-flow is initialized
if [ ! -f ".claude/settings.json" ]; then
    print_error "Claude Flow not initialized. Run: npx claude-flow@alpha init --force"
    exit 1
fi

# Create output directories
mkdir -p .swarm/outputs
mkdir -p .swarm/logs

# Initialize hive-mind
print_header "Initializing Hive-Mind System"
npx claude-flow@alpha hive-mind init
print_success "Hive-mind initialized"

# Function to execute a swarm
execute_swarm() {
    local day=$1
    local name=$2
    local objective=$3
    local agents=$4

    print_header "Day $day: $name"
    print_info "Objective: $objective"
    print_info "Agents: $agents"

    echo "$(date): Starting $name" >> .swarm/logs/sprint.log

    npx claude-flow@alpha swarm "$objective" \
        --agents "$agents" \
        --parallel \
        --output ".swarm/outputs/day$day-$name" \
        --claude

    if [ $? -eq 0 ]; then
        print_success "Day $day completed: $name"
        echo "$(date): Completed $name" >> .swarm/logs/sprint.log
    else
        print_error "Day $day failed: $name"
        echo "$(date): Failed $name" >> .swarm/logs/sprint.log
        exit 1
    fi
}

# Main menu
show_menu() {
    echo ""
    print_header "Love Rank Pulse - Sprint Execution"
    echo "Current Status: ~65% Complete"
    echo ""
    echo "Sprint 1 - Foundation & Infrastructure (Days 1-5):"
    echo "  1) Day 1 - Database & Infrastructure Setup"
    echo "  2) Day 2 - Backend Service Implementation"
    echo "  3) Day 3 - Real-time Updates & WebSocket"
    echo "  4) Day 4 - Frontend Integration"
    echo "  5) Day 5 - Testing Infrastructure"
    echo ""
    echo "Sprint 2 - Deployment & Polish (Days 6-10):"
    echo "  6) Day 6 - CI/CD Pipeline Enhancement"
    echo "  7) Day 7 - Vercel Deployment"
    echo "  8) Day 8 - Performance Optimization"
    echo "  9) Day 9 - Documentation & Quality"
    echo " 10) Day 10 - Final Testing & Launch"
    echo ""
    echo "Batch Operations:"
    echo " 11) Execute Full Sprint 1 (Days 1-5)"
    echo " 12) Execute Full Sprint 2 (Days 6-10)"
    echo " 13) Execute Complete Sprint (Days 1-10)"
    echo ""
    echo " 14) View Progress"
    echo " 15) View Logs"
    echo "  0) Exit"
    echo ""
    read -p "Select option: " choice
}

# Execute individual days
execute_day_1() {
    execute_swarm "1" "database-infrastructure" \
        "Set up PostgreSQL database with Prisma schema, Redis cache layer, Docker containers for all services, and data migration scripts" \
        "database,devops,architecture,data"
}

execute_day_2() {
    execute_swarm "2" "backend-services" \
        "Implement real database-backed PlayerService, MatchService, and LeaderboardService using Prisma, enhance API Gateway with security and rate limiting" \
        "development,api,testing,optimization,security"
}

execute_day_3() {
    execute_swarm "3" "realtime" \
        "Implement WebSocket server with Socket.io for real-time leaderboard updates, match events, and player notifications with authentication and optimization" \
        "development,architecture,optimization,testing"
}

execute_day_4() {
    execute_swarm "4" "frontend-integration" \
        "Integrate frontend with real API endpoints using React Query, implement WebSocket client for real-time updates, differentiate country/global leaderboards, optimize performance" \
        "development,testing,optimization,documentation"
}

execute_day_5() {
    execute_swarm "5" "testing" \
        "Write comprehensive E2E tests with Cypress, component tests for 80% coverage, integration tests for all services, and performance tests for 100 concurrent users" \
        "testing,qa,performance,documentation"
}

execute_day_6() {
    execute_swarm "6" "cicd" \
        "Enhance GitHub Actions workflow with automated testing, coverage reporting, multi-environment deployment, database migrations, and monitoring setup" \
        "devops,github,testing,documentation"
}

execute_day_7() {
    execute_swarm "7" "deployment" \
        "Deploy frontend to Vercel, backend services to cloud provider, configure custom domain with SSL, set up hosted databases, and verify production deployment" \
        "devops,deployment,testing,documentation"
}

execute_day_8() {
    execute_swarm "8" "optimization" \
        "Optimize database queries with indexes, enhance API performance with compression and caching, optimize frontend bundle size and delivery, improve caching strategy across stack" \
        "optimization,performance,database,testing"
}

execute_day_9() {
    execute_swarm "9" "documentation" \
        "Generate comprehensive API documentation with Swagger, create developer and user guides, ensure code quality with linting and TypeScript strict mode, conduct security audit" \
        "documentation,qa,testing,github,security"
}

execute_day_10() {
    execute_swarm "10" "launch" \
        "Execute comprehensive UAT, perform load testing with 1000 users, complete final deployment checklist, prepare launch materials, set up post-launch monitoring" \
        "testing,qa,deployment,documentation,github,devops"
}

# Batch operations
execute_sprint_1() {
    print_header "Executing Full Sprint 1 (Days 1-5)"
    execute_day_1
    execute_day_2
    execute_day_3
    execute_day_4
    execute_day_5
    print_success "Sprint 1 Complete! 🎉"
}

execute_sprint_2() {
    print_header "Executing Full Sprint 2 (Days 6-10)"
    execute_day_6
    execute_day_7
    execute_day_8
    execute_day_9
    execute_day_10
    print_success "Sprint 2 Complete! 🎉"
}

execute_full_sprint() {
    print_header "Executing Complete Sprint (Days 1-10)"
    execute_sprint_1
    execute_sprint_2
    print_success "Complete Sprint Finished! Project is 100% Complete! 🚀"
}

view_progress() {
    print_header "Sprint Progress"

    if [ -f ".swarm/logs/sprint.log" ]; then
        echo ""
        echo "Completed Tasks:"
        grep "Completed" .swarm/logs/sprint.log | tail -10
        echo ""
        echo "Recent Activity:"
        tail -20 .swarm/logs/sprint.log
    else
        print_warning "No progress logs found yet"
    fi

    echo ""
    read -p "Press enter to continue..."
}

view_logs() {
    print_header "Sprint Logs"

    if [ -f ".swarm/logs/sprint.log" ]; then
        less .swarm/logs/sprint.log
    else
        print_warning "No logs found yet"
        read -p "Press enter to continue..."
    fi
}

# Main execution loop
while true; do
    show_menu

    case $choice in
        1) execute_day_1 ;;
        2) execute_day_2 ;;
        3) execute_day_3 ;;
        4) execute_day_4 ;;
        5) execute_day_5 ;;
        6) execute_day_6 ;;
        7) execute_day_7 ;;
        8) execute_day_8 ;;
        9) execute_day_9 ;;
        10) execute_day_10 ;;
        11) execute_sprint_1 ;;
        12) execute_sprint_2 ;;
        13) execute_full_sprint ;;
        14) view_progress ;;
        15) view_logs ;;
        0)
            print_info "Exiting sprint execution"
            exit 0
            ;;
        *)
            print_error "Invalid option"
            ;;
    esac
done
