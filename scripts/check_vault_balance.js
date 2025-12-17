const hre = require("hardhat");
require("dotenv").config();

async function main() {
    const vaultAddress = process.env.ETH_LOCK_VAULT_ADDR;
    console.log("Checking balance of EthLockVault at:", vaultAddress);

    const balance = await hre.ethers.provider.getBalance(vaultAddress);
    console.log("Vault Balance:", hre.ethers.formatEther(balance), "ETH");

    if (balance === 0n) {
        console.log("⚠️ Vault is empty! This is likely the cause of the unlock failure.");
    } else {
        console.log("✅ Vault has funds.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
