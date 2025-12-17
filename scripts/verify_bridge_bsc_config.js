const hre = require("hardhat");
require("dotenv").config();

async function main() {
    const bridgeAddress = process.env.BSC_BRIDGE_ADDRESS;
    console.log("Checking BridgeBSC at:", bridgeAddress);

    const BridgeBSC = await hre.ethers.getContractFactory("BridgeBSC");
    const bridge = BridgeBSC.attach(bridgeAddress);

    const originEthVault = await bridge.originEthVault();
    console.log("Current originEthVault in BridgeBSC:", originEthVault);
    console.log("Expected (New) EthLockVault:", process.env.ETH_LOCK_VAULT_ADDR);

    if (originEthVault === process.env.ETH_LOCK_VAULT_ADDR) {
        console.log("✅ Verification SUCCESS: BridgeBSC points to the new EthLockVault.");
    } else {
        console.error("❌ Verification FAILED: BridgeBSC points to the WRONG address.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
