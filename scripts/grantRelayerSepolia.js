const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [owner] = await hre.ethers.getSigners();
    console.log("Granting relayer role with owner:", owner.address);

    // Load deployment info
    const sepoliaDeploymentPath = path.join(__dirname, "../deployments/sepolia.json");
    if (!fs.existsSync(sepoliaDeploymentPath)) {
        throw new Error("Sepolia deployment not found");
    }
    const sepoliaDeployment = JSON.parse(fs.readFileSync(sepoliaDeploymentPath, "utf8"));
    const vaultAddress = sepoliaDeployment.EthLockVault.address;

    const EthLockVault = await hre.ethers.getContractFactory("EthLockVault");
    const vault = EthLockVault.attach(vaultAddress);

    // Address to grant role to (backend wallet)
    const relayerAddress = "0x6D3Fc231952506ca8bA291B14b684c43b2A4b339";

    console.log(`Granting relayer role to ${relayerAddress} on vault ${vaultAddress}...`);

    const tx = await vault.setRelayer(relayerAddress, true);
    await tx.wait();

    console.log("Relayer role granted successfully on Sepolia!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
