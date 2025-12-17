const hre = require("hardhat");
require("dotenv").config();

async function main() {
    try {
        console.log("Starting BridgeBSC update process...");

        const bridgeAddress = process.env.BSC_BRIDGE_ADDRESS;
        const newEthVaultAddress = process.env.ETH_LOCK_VAULT_ADDR;

        if (!bridgeAddress || !newEthVaultAddress) {
            throw new Error("Missing BSC_BRIDGE_ADDRESS or ETH_LOCK_VAULT_ADDR in .env");
        }

        console.log("BridgeBSC Address:", bridgeAddress);
        console.log("New EthLockVault Address:", newEthVaultAddress);

        const [deployer] = await hre.ethers.getSigners();
        console.log("Updating with account:", deployer.address);

        const BridgeBSC = await hre.ethers.getContractFactory("BridgeBSC");
        const bridge = BridgeBSC.attach(bridgeAddress);

        console.log("Updating originEthVault...");
        // BSC Testnet requires higher gas price sometimes
        const tx = await bridge.setOriginEthVault(newEthVaultAddress, {
            gasPrice: hre.ethers.parseUnits("10", "gwei")
        });
        console.log("Transaction sent:", tx.hash);

        await tx.wait();
        console.log("✅ BridgeBSC updated successfully!");

    } catch (error) {
        console.error("❌ Update failed:", error);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
