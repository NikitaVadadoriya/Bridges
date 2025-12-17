const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const lockId = process.env.LOCK_ID;
    if (!lockId) {
        throw new Error("Please provide LOCK_ID environment variable");
    }

    console.log("Fetching data for Lock ID:", lockId);

    // Load deployment info
    const sepoliaDeploymentPath = path.join(__dirname, "../deployments/sepolia.json");
    if (!fs.existsSync(sepoliaDeploymentPath)) {
        throw new Error("Sepolia deployment not found");
    }
    const sepoliaDeployment = JSON.parse(fs.readFileSync(sepoliaDeploymentPath, "utf8"));
    const vaultAddress = sepoliaDeployment.EthLockVault.address;

    const EthLockVault = await hre.ethers.getContractFactory("EthLockVault");
    const vault = EthLockVault.attach(vaultAddress);

    // Query logs
    const filter = vault.filters.Locked(lockId);
    const events = await vault.queryFilter(filter);

    if (events.length === 0) {
        console.error("No event found for this Lock ID");
        return;
    }

    const event = events[0];
    const args = event.args;

    console.log("\n=== Lock Data for Postman ===");
    console.log(JSON.stringify({
        lockId: args.lockId,
        sender: args.sender,
        recipient: args.dstRecipient,
        amount: args.amount.toString(),
        timestamp: Number(args.timestamp),
        nonce: Number(args.nonce),
        srcChainId: 11155111
    }, null, 2));
    console.log("=============================\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
