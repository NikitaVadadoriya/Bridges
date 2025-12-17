// scripts/deploy_wrapped_bsc_fixed.js
const hre = require("hardhat");
require("dotenv").config();

async function main() {
    try {
        console.log("Starting WrappedEthOnBSC deployment process...");

        // Get signer
        const [deployer] = await hre.ethers.getSigners();
        console.log("Deploying with account:", deployer.address);

        // Check balance
        const balance = await hre.ethers.provider.getBalance(deployer.address);
        console.log("Account balance:", hre.ethers.formatEther(balance), "BNB");

        if (balance === 0n) {
            throw new Error("Insufficient balance! Please fund your wallet with BSC Testnet BNB from a faucet.");
        }

        // Get current gas price
        const feeData = await hre.ethers.provider.getFeeData();
        console.log("Current gas price:", hre.ethers.formatUnits(feeData.gasPrice, "gwei"), "gwei");

        const thisChainId = 97; // BSC Testnet chain id
        const name = "Wrapped ETH (BSC Test)";
        const symbol = "wETHbT";

        console.log("\nDeploying WrappedEthOnBSC to BSC Testnet...");
        console.log("Token Name:", name);
        console.log("Token Symbol:", symbol);

        const Wrapped = await hre.ethers.getContractFactory("WrappedEthOnBSC");

        // Deploy with explicit gas settings
        const wrapped = await Wrapped.deploy(name, symbol, thisChainId, {
            gasLimit: 3000000,
            gasPrice: feeData.gasPrice
        });

        console.log("Transaction sent! Hash:", wrapped.deploymentTransaction().hash);
        console.log("Waiting for confirmation...");

        await wrapped.waitForDeployment();

        console.log("\n✅ WrappedEthOnBSC deployed successfully!");
        console.log("Contract address:", wrapped.target);
        console.log("\n🔑 SAVE THIS ADDRESS as BSC_TOKEN_ADDRESS in your .env file");
        console.log("\nTo verify on BSCScan, run:");
        console.log(`npx hardhat verify --network bscTestnet ${wrapped.target} "${name}" "${symbol}" ${thisChainId}`);

        return wrapped.target;

    } catch (error) {
        console.error("\n❌ Deployment failed!");
        console.error("Error:", error.message);

        if (error.message.includes("insufficient funds")) {
            console.error("\n💡 Solution: Get BSC Testnet BNB from a faucet:");
            console.error("   - https://testnet.bnbchain.org/faucet-smart");
            console.error("   - https://www.bnbchain.org/en/testnet-faucet");
        } else if (error.message.includes("timeout") || error.message.includes("network")) {
            console.error("\n💡 Solution: RPC connection issue. Try:");
            console.error("   1. Check your internet connection");
            console.error("   2. Try a different BSC RPC provider");
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
