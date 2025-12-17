// scripts/deploy_eth_lock_fixed.js
const hre = require("hardhat");
require("dotenv").config();

async function main() {
    try {
        console.log("Starting deployment process...");

        // Get signer
        const [deployer] = await hre.ethers.getSigners();
        console.log("Deploying with account:", deployer.address);

        // Check balance
        const balance = await hre.ethers.provider.getBalance(deployer.address);
        console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");

        if (balance === 0n) {
            throw new Error("Insufficient balance! Please fund your wallet with Sepolia ETH from a faucet.");
        }

        // Get current gas price
        const feeData = await hre.ethers.provider.getFeeData();
        console.log("Current gas price:", hre.ethers.formatUnits(feeData.gasPrice, "gwei"), "gwei");

        const thisChainId = 11155111; // Sepolia chain id

        console.log("\nDeploying EthLockVault to Sepolia...");
        const EthLockVault = await hre.ethers.getContractFactory("EthLockVault");

        // Deploy with explicit gas settings
        const vault = await EthLockVault.deploy(thisChainId, {
            gasLimit: 3000000,
            maxFeePerGas: feeData.maxFeePerGas,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
        });

        console.log("Transaction sent! Hash:", vault.deploymentTransaction().hash);
        console.log("Waiting for confirmation...");

        await vault.waitForDeployment();

        console.log("\n✅ EthLockVault deployed successfully!");
        console.log("Contract address:", vault.target);
        console.log("\n🔑 SAVE THIS ADDRESS as ETH_LOCK_VAULT_ADDR in your .env file");
        console.log("\nTo verify on Etherscan, run:");
        console.log(`npx hardhat verify --network sepolia ${vault.target} ${thisChainId}`);

    } catch (error) {
        console.error("\n❌ Deployment failed!");
        console.error("Error:", error.message);

        if (error.message.includes("insufficient funds")) {
            console.error("\n💡 Solution: Get Sepolia ETH from a faucet:");
            console.error("   - https://sepoliafaucet.com/");
            console.error("   - https://www.alchemy.com/faucets/ethereum-sepolia");
        } else if (error.message.includes("timeout") || error.message.includes("network")) {
            console.error("\n💡 Solution: RPC connection issue. Try:");
            console.error("   1. Check your internet connection");
            console.error("   2. Verify your Alchemy API key is valid");
            console.error("   3. Try a different RPC provider");
        }

        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
