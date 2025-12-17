# 🌉 ETH Bridge Deployment Guide

## સમસ્યા અને ઉકેલ (Problem & Solution)

### સમસ્યા: Deployment અટકી જાય છે
જ્યારે તમે `npx hardhat run --network sepolia scripts/deploy_eth_lock.js` run કરો છો, પણ કંઈ output નથી આવતું અને deployment અટકી જાય છે.

### કારણો (Reasons):
1. **RPC Timeout** - Network connection slow હોય
2. **Gas Price Issues** - Gas price યોગ્ય રીતે set ન હોય
3. **Insufficient Balance** - Wallet માં પૂરતું ETH/BNB ન હોય
4. **Network Congestion** - Network busy હોય

### ઉકેલ (Solution):
આ સુધારેલી scripts timeout, error handling, અને balance checking સાથે આવે છે.

---

## 📋 Deployment Steps

### Step 1: Sepolia પર EthLockVault Deploy કરો

```bash
npx hardhat run --network sepolia scripts/deploy_eth_lock_fixed.js
```

**આ script:**
- ✅ તમારું balance check કરશે
- ✅ Gas price બતાવશે
- ✅ Deployment status બતાવશે
- ✅ સારા error messages આપશે

**Output માંથી address save કરો:**
```
ETH_LOCK_VAULT_ADDR=0x...
```

---

### Step 2: BSC પર WrappedEthOnBSC Deploy કરો

```bash
npx hardhat run --network bscTestnet scripts/deploy_wrapped_bsc_fixed.js
```

**Output માંથી address save કરો:**
```
BSC_TOKEN_ADDRESS=0x...
```

---

### Step 3: BSC પર BridgeBSC Deploy કરો

**Option 1: .env file વાપરો (આસાન)**

પહેલા `.env` માં addresses add કરો:
```
ETH_LOCK_VAULT_ADDR=0x...  (Step 1 થી)
BSC_TOKEN_ADDRESS=0x...     (Step 2 થી)
```

પછી run કરો:
```bash
npx hardhat run --network bscTestnet scripts/deploy_bridge_bsc_fixed.js
```

**Option 2: Command line arguments**

```bash
npx hardhat run --network bscTestnet scripts/deploy_bridge_bsc_fixed.js <WRAPPED_ADDR> <ETH_VAULT_ADDR>
```

**Output માંથી address save કરો:**
```
BSC_BRIDGE_ADDRESS=0x...
```

---

### Step 4: Minter Role Grant કરો

`.env` માં BSC_BRIDGE_ADDRESS add કર્યા પછી:

```bash
npx hardhat run --network bscTestnet scripts/grant_minter_role.js
```

આ bridge ને wrapped token mint કરવાની permission આપશે.

---

## 🔧 Troubleshooting

### "Insufficient balance" Error

**Sepolia માટે:**
- https://sepoliafaucet.com/
- https://www.alchemy.com/faucets/ethereum-sepolia

**BSC Testnet માટે:**
- https://testnet.bnbchain.org/faucet-smart
- https://www.bnbchain.org/en/testnet-faucet

### "Timeout" Error

1. Internet connection check કરો
2. RPC URL બદલો
3. ફરીથી try કરો

### "Network Error"

Hardhat config માં timeout વધારો:
```javascript
sepolia: {
    timeout: 180000, // 3 minutes
    // ...
}
```

---

## 📝 Final .env File

Deployment પછી તમારી `.env` file આવી દેખાવી જોઈએ:

```env
# Wallet
PRIVATE_KEY=your_private_key

# RPC URLs
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.bnbchain.org:8545

# Deployed Contracts
ETH_LOCK_VAULT_ADDR=0x...      # Step 1
BSC_TOKEN_ADDRESS=0x...         # Step 2
BSC_BRIDGE_ADDRESS=0x...        # Step 3
```

---

## ✅ Verification

Contracts verify કરવા માટે:

**Sepolia:**
```bash
npx hardhat verify --network sepolia <ETH_LOCK_VAULT_ADDR> 11155111
```

**BSC Testnet - Wrapped Token:**
```bash
npx hardhat verify --network bscTestnet <BSC_TOKEN_ADDRESS> "Wrapped ETH (BSC Test)" "wETHbT" 97
```

**BSC Testnet - Bridge:**
```bash
npx hardhat verify --network bscTestnet <BSC_BRIDGE_ADDRESS> <BSC_TOKEN_ADDRESS> <ETH_LOCK_VAULT_ADDR> 97 11155111
```

---

## 🎯 Next Steps

1. Backend setup કરો
2. Merkle root update કરવાની system બનાવો
3. Frontend સાથે connect કરો
4. Testing કરો

---

## 📞 Common Issues

| Issue | Solution |
|-------|----------|
| Deployment hangs | Use `*_fixed.js` scripts |
| No output | Check RPC URL and internet |
| Gas too high | Wait for network to be less busy |
| Insufficient funds | Get testnet tokens from faucet |
| Role grant fails | Make sure BSC_BRIDGE_ADDRESS is set |

---

Made with ❤️ for smooth deployments!
