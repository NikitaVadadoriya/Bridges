const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [owner] = await hre.ethers.getSigners();
    console.log("Granting relayer role with owner:", owner.address);

    // Load deployment info
    const bscDeploymentPath = path.join(__dirname, "../deployments/bscTestnet.json");
    if (!fs.existsSync(bscDeploymentPath)) {
        throw new Error("BSC deployment not found");
    }
    const bscDeployment = JSON.parse(fs.readFileSync(bscDeploymentPath, "utf8"));
    const bridgeAddress = bscDeployment.contracts.BridgeBSC.address;

    const BridgeBSC = await hre.ethers.getContractFactory("BridgeBSC");
    const bridge = BridgeBSC.attach(bridgeAddress);

    // Address to grant role to (from backend logs/env)
    const relayerAddress = "0x6D3Fc231952506ca8bA291B14b684c43b2A4b339";

    console.log(`Granting relayer role to ${relayerAddress} on bridge ${bridgeAddress}...`);

    const tx = await bridge.setRelayer(relayerAddress, true);
    await tx.wait();

    console.log("Relayer role granted successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
