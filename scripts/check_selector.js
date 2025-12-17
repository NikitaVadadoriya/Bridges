const { ethers } = require("ethers");

async function main() {
    const oldSig = "unlockETH(bytes32,address,uint256,uint256,uint256,uint256,address,bytes32[])";
    const newSig = "unlockETH(bytes32,address,uint256,uint256,uint256,uint256,address,address,bytes32[])";

    const oldSelector = ethers.id(oldSig).slice(0, 10);
    const newSelector = ethers.id(newSig).slice(0, 10);

    console.log("Old Selector:", oldSelector);
    console.log("New Selector:", newSelector);

    const txData = "0x8b73c349"; // From user logs
    console.log("Tx Selector: ", txData);

    if (txData === oldSelector) {
        console.log("⚠️  The transaction is using the OLD selector!");
    } else if (txData === newSelector) {
        console.log("✅ The transaction is using the NEW selector.");
    } else {
        console.log("❓ The transaction selector matches neither.");
    }
}

main();
