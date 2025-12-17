const hre = require("hardhat");
require("dotenv").config();
const { ethers } = require("ethers");

async function main() {
    const vaultAddress = process.env.ETH_LOCK_VAULT_ADDR;
    console.log("Debugging EthLockVault at:", vaultAddress);

    const [deployer] = await hre.ethers.getSigners();
    const EthLockVault = await hre.ethers.getContractFactory("EthLockVault");
    const vault = EthLockVault.attach(vaultAddress);

    // Data from user's latest failed request
    const burnId = "0x24e28ed8a4969852fa9e1c1e7fe660e5d64d29ffc2c7606a47a91599b81acd75";
    const burner = "0x6D3Fc231952506ca8bA291B14b684c43b2A4b339";
    const to = "0x6D3Fc231952506ca8bA291B14b684c43b2A4b339";
    const amount = "10000000000000";
    const timestamp = "1765776698";
    const nonce = "7";

    const originBscContract = process.env.BSC_TOKEN_ADDRESS; // 0xD78681f750eA8F71A833b2e0d9d23825B042e630
    const bscChainId = 97;
    const thisChainId = 11155111;
    const BURN_TAG = ethers.keccak256(ethers.toUtf8Bytes("BURN_VAULT_BSC_v1"));

    console.log("--- Parameters ---");
    console.log("BurnId:", burnId);
    console.log("Burner:", burner);
    console.log("OriginBSC:", originBscContract);

    // 1. Check Merkle Root
    const currentRoot = await vault.merkleRoot();
    console.log("\nCurrent Merkle Root on Contract:", currentRoot);

    if (currentRoot === ethers.ZeroHash) {
        console.error("❌ Merkle Root is NOT set on contract!");
        return;
    }

    // 2. Reconstruct Burn ID locally to verify match
    const calculatedBurnId = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ["bytes32", "address", "uint256", "uint256", "address", "address", "uint256", "uint256", "uint256"],
            [
                BURN_TAG,
                originBscContract,
                bscChainId,
                thisChainId,
                burner,
                to,
                amount,
                nonce,
                timestamp
            ]
        )
    );
    console.log("\nCalculated Burn ID (JS):", calculatedBurnId);

    if (calculatedBurnId !== burnId) {
        console.error("❌ Burn ID Mismatch in JS calculation!");
        console.log("Expected:", burnId);
        console.log("Got:     ", calculatedBurnId);
    } else {
        console.log("✅ Burn ID calculation matches!");
    }

    // 3. Reconstruct Leaf
    const leaf = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ["bytes32", "address", "bytes32", "address", "address", "uint256", "uint256", "uint256", "uint256", "uint256"],
            [
                BURN_TAG,
                originBscContract,
                burnId,
                burner,
                to,
                amount,
                nonce,
                timestamp,
                bscChainId,
                thisChainId
            ]
        )
    );
    console.log("Leaf:", leaf);

    // Assuming single leaf tree for this debug session (since backend restarted)
    // If the root on contract matches this leaf, then proof is empty.
    let proof = [];
    if (currentRoot === leaf) {
        console.log("Root matches leaf, proof is empty.");
    } else {
        console.log("⚠️ Root does not match leaf. The backend might have a different tree state.");
        // We can't easily guess the proof if there are other leaves.
        // But let's try to call unlock anyway, maybe the root on contract IS correct for this leaf.
    }

    // 4. Attempt Static Call to unlockETH
    console.log("\nAttempting static call to unlockETH...");
    try {
        await vault.unlockETH.staticCall(
            burnId,
            to,
            amount,
            bscChainId,
            nonce,
            timestamp,
            originBscContract,
            burner,
            proof
        );
        console.log("✅ Static call SUCCESS! Transaction should work.");
    } catch (error) {
        console.error("❌ Static call FAILED!");
        if (error.data) {
            console.error("Revert Data:", error.data);
            try {
                const decoded = vault.interface.parseError(error.data);
                console.error("Decoded Error:", decoded);
            } catch (e) {
                console.error("Could not decode error data.");
            }
        } else {
            console.error("Error Message:", error.message);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
