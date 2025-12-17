# 🌉 ETH Bridge - Updated for Deployed Contracts

## ✅ Deployment Status

Your contracts are successfully deployed:

### Sepolia (Ethereum Testnet)
- **EthLockVault**: `0xe18A36A75A7e0221a46f32893869986A36e8AAB7`

### BSC Testnet
- **WrappedEthOnBSC (wETHbT)**: `0xe3dE6AAe0E3cAb8eDCb40c6068506C0B27e9d2F5`
- **BridgeBSC**: `0x1990c2b849623231D721d27cef4e256C1c3e6b21`

---

## 🔄 What Changed

### Backend Updates (`backend/index.js`)
✅ **Contract ABIs** - Updated to match your deployed contracts  
✅ **Event Signatures** - Correct event parameters for `Locked` and `Burned`  
✅ **Merkle Tree Leaves** - Proper leaf construction matching contract logic  
✅ **Function Calls** - Correct parameters for `mintFromSepolia` and `unlockETH`  
✅ **Tags** - Using `LOCK_VAULT_ETH_v1` and `BURN_VAULT_BSC_v1`  

### Frontend Updates (`frontend/src/App.js`)
✅ **Contract ABIs** - Simplified to only needed functions  
✅ **Event Parsing** - Correct event signature matching  
✅ **Burn Functionality** - Burns ALL tokens (as per contract design)  
✅ **Token Balance Display** - Shows wETHbT balance on BSC  
✅ **Better UX** - Status chips, better error messages  

---

## 🚀 How to Run

### 1. Start Backend

```bash
cd backend
npm install
node index.js
```

**Expected Output:**
```
🌉 Bridge Backend running on port 3001
📡 Sepolia RPC: https://eth-sepolia.g.alchemy.com/v2/...
📡 BSC RPC: https://data-seed-prebsc-1-s1.bnbchain.org:8545...
✅ Merkle trees initialized
```

### 2. Start Frontend

```bash
cd frontend
npm install
npm start
```

**Opens:** `http://localhost:3000`

---

## 📋 How to Use the Bridge

### Sepolia → BSC (Lock ETH, Mint wETHbT)

1. **Connect Wallet** to MetaMask
2. **Switch to Sepolia** network
3. Go to **"Sepolia → BSC"** tab
4. Enter:
   - Amount of ETH to lock
   - BSC recipient address
5. Click **"Lock ETH"**
6. **Confirm** transaction in MetaMask
7. **Wait** for backend to process (auto-mints on BSC)
8. **Check BSC** - tokens will appear in recipient wallet

### BSC → Sepolia (Burn wETHbT, Unlock ETH)

1. **Connect Wallet** to MetaMask
2. **Switch to BSC Testnet**
3. Go to **"BSC → Sepolia"** tab
4. Your token balance will show automatically
5. Enter:
   - Sepolia recipient address (where ETH will be unlocked)
6. Click **"Burn All Tokens"**
7. **Confirm** transaction in MetaMask
8. **Wait** for backend to process (auto-unlocks on Sepolia)
9. **Check Sepolia** - ETH will appear in recipient wallet

---

## 🔍 Key Differences from Old Code

### 1. Event Signature
**Old:**
```javascript
event Locked(bytes32 indexed lockId, address indexed sender, uint256 amount, ...)
```

**New (Your Contract):**
```javascript
event Locked(bytes32 indexed lockId, address indexed sender, address indexed to, uint256 amount, uint256 nonce, uint256 timestamp, uint256 srcChainId, uint256 dstChainId)
```

### 2. Function Parameters
**Old:**
```javascript
lockETH(uint256 dstChainId, address dstRecipient) payable
```

**New (Your Contract):**
```javascript
lockETH(address to, uint256 dstChainId) payable
```

### 3. Burn Functionality
**Old:** Burn specific amount  
**New:** Burns ALL tokens in wallet (simpler, safer)

### 4. Merkle Leaf Construction
**Old:** Simple encoding  
**New:** Includes TAG, contract addresses, and all event fields

---

## 🧪 Testing Checklist

- [ ] Backend starts without errors
- [ ] Frontend loads contract addresses
- [ ] Can connect MetaMask
- [ ] Can switch between Sepolia and BSC
- [ ] Lock ETH on Sepolia works
- [ ] Backend auto-mints on BSC
- [ ] Token balance shows on BSC
- [ ] Burn tokens on BSC works
- [ ] Backend auto-unlocks on Sepolia
- [ ] ETH received on Sepolia

---

## 🐛 Troubleshooting

### Backend Error: "Cannot read property 'vault' of undefined"
**Solution:** Make sure `.env` file has all contract addresses

### Frontend: "Invalid vault address"
**Solution:** Backend not running or contracts not loaded. Check backend console.

### Transaction Fails: "execution reverted"
**Possible Causes:**
1. Insufficient gas
2. Already processed (duplicate lockId/burnId)
3. Invalid Merkle proof
4. Bridge doesn't have minter role (run `grant_minter_role.js`)

### Tokens not minted after locking
**Check:**
1. Backend console for errors
2. Bridge has ownership of wrapped token
3. Merkle root was updated
4. Transaction succeeded on BSC

---

## 📊 Architecture

```
User (Sepolia)
    ↓ Lock ETH
EthLockVault Contract
    ↓ Emit Locked event
Frontend
    ↓ Send to backend
Backend
    ↓ Add to Merkle Tree
    ↓ Update Merkle Root on BSC
    ↓ Call mintFromSepolia
BridgeBSC Contract
    ↓ Verify Merkle Proof
    ↓ Call mint on WrappedEthOnBSC
WrappedEthOnBSC Contract
    ↓ Mint tokens
User (BSC) receives wETHbT
```

**Reverse flow for burning:**
```
User (BSC) → Burn wETHbT → Backend → Update Merkle Root → Unlock ETH → User (Sepolia)
```

---

## 🔐 Security Notes

⚠️ **This is for TESTNET only!**

For production:
1. Replace owner with multisig/timelock
2. Add rate limiting
3. Add monitoring/alerts
4. Audit all contracts
5. Use decentralized oracle network
6. Add emergency pause functionality

---

## 📞 Support

If you encounter issues:
1. Check backend console logs
2. Check browser console (F12)
3. Verify contract addresses in `.env`
4. Ensure backend is running
5. Check MetaMask network

---

Made with ❤️ for seamless cross-chain transfers!

