// scripts/grant_minter_role.js
const hre = require("hardhat");
require("dotenv").config();

async function main() {
    try {
        console.log("Starting ownership transfer process...");
        console.log("(WrappedEthOnBSC uses Ownable, not AccessControl)");

        // Get addresses from .env
        const wrappedAddr = process.env.BSC_TOKEN_ADDRESS;
        const bridgeAddr = process.env.BSC_BRIDGE_ADDRESS;

        if (!wrappedAddr || !bridgeAddr) {
            console.error("\n❌ Missing required addresses in .env file!");
            console.error("  BSC_TOKEN_ADDRESS:", wrappedAddr || "NOT SET");
            console.error("  BSC_BRIDGE_ADDRESS:", bridgeAddr || "NOT SET");
            process.exit(1);
        }

        console.log("\nConfiguration:");
        console.log("  Wrapped Token:", wrappedAddr);
        console.log("  Bridge Contract:", bridgeAddr);

        // Get signer
        const [deployer] = await hre.ethers.getSigners();
        console.log("  Current owner:", deployer.address);

        // Get contract instance
        const wrapped = await hre.ethers.getContractAt("WrappedEthOnBSC", wrappedAddr);

        // Check current owner
        const currentOwner = await wrapped.owner();
        console.log("  Contract owner:", currentOwner);

        if (currentOwner.toLowerCase() === bridgeAddr.toLowerCase()) {
            console.log("\n✅ Bridge is already the owner!");
            return;
        }

        console.log("\n🔄 Transferring ownership to bridge...");
        console.log("⚠️  WARNING: After this, only the bridge can mint tokens!");
        console.log("   Make sure the bridge contract is correct!");

        // Validate and checksum the bridge address
        if (!hre.ethers.isAddress(bridgeAddr)) {
            throw new Error(`Invalid bridge address: ${bridgeAddr}`);
        }
        const checksumBridgeAddr = hre.ethers.getAddress(bridgeAddr);
        console.log("Checksummed bridge address:", checksumBridgeAddr);

        // Get current gas price and increase it
        const feeData = await hre.ethers.provider.getFeeData();
        const gasPrice = feeData.gasPrice * 2n; // Double the gas price for BSC

        console.log("Gas price:", hre.ethers.formatUnits(gasPrice, "gwei"), "gwei");

        const tx = await wrapped.transferOwnership(checksumBridgeAddr, {
            gasPrice: gasPrice,
            gasLimit: 100000
        });
        console.log("Transaction sent! Hash:", tx.hash);
        console.log("Waiting for confirmation...");

        await tx.wait();

        console.log("\n✅ Ownership transferred successfully!");

        // Verify
        const newOwner = await wrapped.owner();
        console.log("New owner:", newOwner);
        console.log("Verification:", newOwner.toLowerCase() === bridgeAddr.toLowerCase() ? "✅ Confirmed" : "❌ Failed");

        console.log("\n📝 Note: The bridge contract can now mint tokens.");
        console.log("   Your deployer address can no longer mint directly.");

    } catch (error) {
        console.error("\n❌ Failed to transfer ownership!");
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
