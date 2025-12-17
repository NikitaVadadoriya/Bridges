const hre = require("hardhat");
require("dotenv").config();

async function main() {
    const vaultAddress = process.env.ETH_LOCK_VAULT_ADDR;
    console.log("Funding EthLockVault at:", vaultAddress);

    const [deployer] = await hre.ethers.getSigners();
    const amount = hre.ethers.parseEther("0.01"); // Fund with 0.01 ETH

    console.log("Locking 0.01 ETH to fund the vault...");

    const EthLockVault = await hre.ethers.getContractFactory("EthLockVault");
    const vault = EthLockVault.attach(vaultAddress);

    // We lock ETH to ourselves on BSC (chain ID 97)
    // This will deposit ETH into the vault
    // Note: We use a random dstChainId (97) just to deposit funds.
    // The vault doesn't care if we actually bridge it, it just stores the ETH.
    const tx = await vault.lockETH(deployer.address, 97, {
        value: amount
    });

    console.log("Transaction sent:", tx.hash);
    await tx.wait();
    console.log("✅ Vault funded successfully!");

    const balance = await hre.ethers.provider.getBalance(vaultAddress);
    console.log("New Vault Balance:", hre.ethers.formatEther(balance), "ETH");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
