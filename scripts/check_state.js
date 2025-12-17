const hre = require("hardhat");
require("dotenv").config();

async function main() {
    const vaultAddress = process.env.ETH_LOCK_VAULT_ADDR;
    console.log("Checking EthLockVault at:", vaultAddress);

    // 1. Check Code
    const code = await hre.ethers.provider.getCode(vaultAddress);
    if (code === "0x") {
        console.error("❌ NO CODE at this address! Contract might not be deployed or address is wrong.");
        return;
    }
    console.log("✅ Contract code exists.");

    // 2. Check Balance
    const balance = await hre.ethers.provider.getBalance(vaultAddress);
    console.log("Vault Balance:", hre.ethers.formatEther(balance), "ETH");

    // 3. Check Merkle Root
    const EthLockVault = await hre.ethers.getContractFactory("EthLockVault");
    const vault = EthLockVault.attach(vaultAddress);

    try {
        const root = await vault.merkleRoot();
        console.log("Merkle Root:", root);
        if (root === hre.ethers.ZeroHash) {
            console.warn("⚠️ Merkle Root is 0x0. This will cause 'Merkle root not set' revert.");
        } else {
            console.log("✅ Merkle Root is set.");
        }
    } catch (e) {
        console.error("❌ Failed to read merkleRoot:", e.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
