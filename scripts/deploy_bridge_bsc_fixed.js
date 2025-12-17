// scripts/deploy_bridge_bsc_fixed.js
const hre = require("hardhat");
require("dotenv").config();

async function main() {
    try {
        console.log("Starting BridgeBSC deployment process...");

        // Get signer
        const [deployer] = await hre.ethers.getSigners();
        console.log("Deploying with account:", deployer.address);

        // Check balance
        const balance = await hre.ethers.provider.getBalance(deployer.address);
        console.log("Account balance:", hre.ethers.formatEther(balance), "BNB");

        if (balance === 0n) {
            throw new Error("Insufficient balance! Please fund your wallet with BSC Testnet BNB from a faucet.");
        }

        // Get arguments
        const args = process.argv.slice(2);

        let wrappedAddr, originEthVaultAddr;

        // Try to get from command line args or .env
        if (args.length >= 2) {
            wrappedAddr = args[0];
            originEthVaultAddr = args[1];
        } else {
            // Try to get from .env
            wrappedAddr = process.env.BSC_TOKEN_ADDRESS;
            originEthVaultAddr = process.env.ETH_LOCK_VAULT_ADDR;

            if (!wrappedAddr || !originEthVaultAddr) {
                console.error("\n❌ Missing required addresses!");
                console.error("\nUsage Option 1 (command line):");
                console.error("  npx hardhat run --network bscTestnet scripts/deploy_bridge_bsc_fixed.js <wrappedAddr> <originEthVaultAddr>");
                console.error("\nUsage Option 2 (.env file):");
                console.error("  Set BSC_TOKEN_ADDRESS and ETH_LOCK_VAULT_ADDR in .env file");
                console.error("\nCurrent values:");
                console.error("  BSC_TOKEN_ADDRESS:", wrappedAddr || "NOT SET");
                console.error("  ETH_LOCK_VAULT_ADDR:", originEthVaultAddr || "NOT SET");
                process.exit(1);
            }

            console.log("\n📝 Using addresses from .env file");
        }

        // Validate addresses
        if (!hre.ethers.isAddress(wrappedAddr)) {
            throw new Error(`Invalid wrapped token address: ${wrappedAddr}`);
        }
        if (!hre.ethers.isAddress(originEthVaultAddr)) {
            throw new Error(`Invalid origin vault address: ${originEthVaultAddr}`);
        }

        const thisChainId = 97; // BSC testnet
        const sepoliaChainId = 11155111; // Sepolia chain id (origin)

        console.log("\nDeployment Configuration:");
        console.log("  Wrapped Token Address:", wrappedAddr);
        console.log("  Origin ETH Vault Address:", originEthVaultAddr);
        console.log("  This Chain ID (BSC):", thisChainId);
        console.log("  Sepolia Chain ID:", sepoliaChainId);

        // Get current gas price
        const feeData = await hre.ethers.provider.getFeeData();
        console.log("\nCurrent gas price:", hre.ethers.formatUnits(feeData.gasPrice, "gwei"), "gwei");

        console.log("\nDeploying BridgeBSC to BSC Testnet...");
        const Bridge = await hre.ethers.getContractFactory("BridgeBSC");

        // Deploy with explicit gas settings
        const bridge = await Bridge.deploy(
            wrappedAddr,
            originEthVaultAddr,
            thisChainId,
            sepoliaChainId,
            {
                gasLimit: 3000000,
                gasPrice: feeData.gasPrice
            }
        );

        console.log("Transaction sent! Hash:", bridge.deploymentTransaction().hash);
        console.log("Waiting for confirmation...");

        await bridge.waitForDeployment();

        console.log("\n✅ BridgeBSC deployed successfully!");
        console.log("Contract address:", bridge.target);
        console.log("\n🔑 SAVE THIS ADDRESS as BSC_BRIDGE_ADDRESS in your .env file");

        console.log("\n📋 Deployment Summary:");
        console.log("  Bridge Address:", bridge.target);
        console.log("  Wrapped Token:", wrappedAddr);
        console.log("  Origin Vault:", originEthVaultAddr);
        console.log("  Sepolia Chain ID:", sepoliaChainId);
        console.log("  BSC Chain ID:", thisChainId);

        console.log("\n⚠️  IMPORTANT NEXT STEPS:");
        console.log("  1. Grant MINTER_ROLE to bridge on WrappedEthOnBSC contract");
        console.log("     Run: npx hardhat run scripts/grant_minter_role.js --network bscTestnet");
        console.log("\n  2. Update .env file with BSC_BRIDGE_ADDRESS");

        console.log("\nTo verify on BSCScan, run:");
        console.log(`npx hardhat verify --network bscTestnet ${bridge.target} ${wrappedAddr} ${originEthVaultAddr} ${thisChainId} ${sepoliaChainId}`);

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
