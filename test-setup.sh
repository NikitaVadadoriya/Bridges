#!/bin/bash

echo "🧪 Testing Bridge Setup..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check .env file
echo "📝 Checking .env file..."
if [ -f .env ]; then
    echo -e "${GREEN}✓${NC} .env file exists"
    
    # Check required variables
    if grep -q "ETH_LOCK_VAULT_ADDR=0x" .env; then
        VAULT_ADDR=$(grep "ETH_LOCK_VAULT_ADDR=" .env | cut -d '=' -f2)
        echo -e "${GREEN}✓${NC} ETH_LOCK_VAULT_ADDR: $VAULT_ADDR"
    else
        echo -e "${RED}✗${NC} ETH_LOCK_VAULT_ADDR not set"
    fi
    
    if grep -q "BSC_BRIDGE_ADDRESS=0x" .env; then
        BRIDGE_ADDR=$(grep "BSC_BRIDGE_ADDRESS=" .env | cut -d '=' -f2)
        echo -e "${GREEN}✓${NC} BSC_BRIDGE_ADDRESS: $BRIDGE_ADDR"
    else
        echo -e "${RED}✗${NC} BSC_BRIDGE_ADDRESS not set"
    fi
    
    if grep -q "BSC_TOKEN_ADDRESS=0x" .env; then
        TOKEN_ADDR=$(grep "BSC_TOKEN_ADDRESS=" .env | cut -d '=' -f2)
        echo -e "${GREEN}✓${NC} BSC_TOKEN_ADDRESS: $TOKEN_ADDR"
    else
        echo -e "${RED}✗${NC} BSC_TOKEN_ADDRESS not set"
    fi
else
    echo -e "${RED}✗${NC} .env file not found"
    exit 1
fi

echo ""
echo "📦 Checking backend dependencies..."
if [ -d "backend/node_modules" ]; then
    echo -e "${GREEN}✓${NC} Backend node_modules exists"
else
    echo -e "${YELLOW}!${NC} Backend dependencies not installed"
    echo "   Run: cd backend && npm install"
fi

echo ""
echo "📦 Checking frontend dependencies..."
if [ -d "frontend/node_modules" ]; then
    echo -e "${GREEN}✓${NC} Frontend node_modules exists"
else
    echo -e "${YELLOW}!${NC} Frontend dependencies not installed"
    echo "   Run: cd frontend && npm install"
fi

echo ""
echo "🔌 Testing RPC connections..."

# Test Sepolia RPC
SEPOLIA_RPC=$(grep "SEPOLIA_RPC_URL=" .env | cut -d '=' -f2)
if [ ! -z "$SEPOLIA_RPC" ]; then
    SEPOLIA_RESPONSE=$(curl -s -X POST $SEPOLIA_RPC \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | grep -o "result")
    
    if [ ! -z "$SEPOLIA_RESPONSE" ]; then
        echo -e "${GREEN}✓${NC} Sepolia RPC is working"
    else
        echo -e "${RED}✗${NC} Sepolia RPC connection failed"
    fi
else
    echo -e "${RED}✗${NC} SEPOLIA_RPC_URL not set"
fi

# Test BSC RPC
BSC_RPC=$(grep "BSC_TESTNET_RPC_URL=" .env | cut -d '=' -f2)
if [ ! -z "$BSC_RPC" ]; then
    BSC_RESPONSE=$(curl -s -X POST $BSC_RPC \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | grep -o "result")
    
    if [ ! -z "$BSC_RESPONSE" ]; then
        echo -e "${GREEN}✓${NC} BSC RPC is working"
    else
        echo -e "${RED}✗${NC} BSC RPC connection failed"
    fi
else
    echo -e "${RED}✗${NC} BSC_TESTNET_RPC_URL not set"
fi

echo ""
echo "📋 Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Sepolia Vault:  $VAULT_ADDR"
echo "BSC Bridge:     $BRIDGE_ADDR"
echo "BSC Token:      $TOKEN_ADDR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🚀 To start the bridge:"
echo "   1. Terminal 1: cd backend && node index.js"
echo "   2. Terminal 2: cd frontend && npm start"
echo ""
