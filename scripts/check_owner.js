// scripts/check_owner.js
const hre = require("hardhat");
require("dotenv").config();

async function main() {
    const wrappedAddr = process.env.BSC_TOKEN_ADDRESS;
    const bridgeAddr = process.env.BSC_BRIDGE_ADDRESS;

    console.log("Checking ownership...");
    console.log("Token:", wrappedAddr);
    console.log("Expected owner (bridge):", bridgeAddr);

    const wrapped = await hre.ethers.getContractAt("WrappedEthOnBSC", wrappedAddr);
    const currentOwner = await wrapped.owner();

    console.log("\nCurrent owner:", currentOwner);
    console.log("Is bridge owner?", currentOwner.toLowerCase() === bridgeAddr.toLowerCase());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
