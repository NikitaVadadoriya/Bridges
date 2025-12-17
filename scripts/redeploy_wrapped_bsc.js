// scripts/redeploy_wrapped_bsc.js
const hre = require("hardhat");
require("dotenv").config();

async function main() {
    try {
        console.log("🔄 Redeploying WrappedEthOnBSC with updated burnForSepolia...");

        const [deployer] = await hre.ethers.getSigners();
        console.log("Deploying with account:", deployer.address);

        const balance = await hre.ethers.provider.getBalance(deployer.address);
        console.log("Account balance:", hre.ethers.formatEther(balance), "BNB");

        const thisChainId = 97;
        const name = "Wrapped ETH (BSC Test)";
        const symbol = "wETHbT";

        console.log("\n📦 Deploying new WrappedEthOnBSC...");
        const Wrapped = await hre.ethers.getContractFactory("WrappedEthOnBSC");

        const feeData = await hre.ethers.provider.getFeeData();
        const wrapped = await Wrapped.deploy(name, symbol, thisChainId, {
            gasLimit: 3000000,
            gasPrice: feeData.gasPrice
        });

        console.log("Transaction sent! Hash:", wrapped.deploymentTransaction().hash);
        await wrapped.waitForDeployment();

        console.log("\n✅ New WrappedEthOnBSC deployed!");
        console.log("Contract address:", wrapped.target);

        console.log("\n⚠️  IMPORTANT NEXT STEPS:");
        console.log("1. Update BSC_TOKEN_ADDRESS in .env:");
        console.log(`   BSC_TOKEN_ADDRESS=${wrapped.target}`);
        console.log("\n2. Redeploy BridgeBSC with new token address:");
        console.log(`   npx hardhat run --network bscTestnet scripts/deploy_bridge_bsc_fixed.js`);
        console.log("\n3. Transfer ownership to bridge:");
        console.log(`   npx hardhat run --network bscTestnet scripts/grant_minter_role.js`);

    } catch (error) {
        console.error("\n❌ Deployment failed!");
        console.error("Error:", error.message);
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
