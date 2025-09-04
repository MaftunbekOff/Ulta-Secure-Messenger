
#!/bin/bash

echo "🚀 UltraSecure Messenger Load Testing Suite"
echo "==========================================="

# Build the load tester
echo "📦 Building load tester..."
go mod init load-testing 2>/dev/null || true
go mod tidy
go build -o benchmark benchmark.go

if [ $? -ne 0 ]; then
    echo "❌ Failed to build load tester"
    exit 1
fi

echo "✅ Load tester built successfully"

# Test scenarios
echo ""
echo "🎯 Running load test scenarios..."

echo ""
echo "📊 Scenario 1: Small Scale (1,000 users)"
./benchmark 1000 &
SMALL_PID=$!
sleep 30
kill $SMALL_PID 2>/dev/null

echo ""
echo "📊 Scenario 2: Medium Scale (10,000 users)"  
./benchmark 10000 &
MEDIUM_PID=$!
sleep 60
kill $MEDIUM_PID 2>/dev/null

echo ""
echo "📊 Scenario 3: Large Scale (100,000 users)"
echo "⚠️  This test may take several minutes..."
./benchmark 100000 &
LARGE_PID=$!
sleep 120
kill $LARGE_PID 2>/dev/null

echo ""
echo "🏆 Load testing complete!"
echo "Check the output above for performance metrics"
echo ""
echo "💡 Tips for optimization:"
echo "- Monitor server CPU and memory usage"
echo "- Adjust Go websocket.go server settings"
echo "- Scale Replit resources if needed"
echo "- Use Rust components for ultra-fast processing"

# Cleanup
rm -f benchmark
