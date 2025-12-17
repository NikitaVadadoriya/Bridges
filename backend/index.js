const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.BACKEND_PORT || 3002;

app.use(cors());
app.use(express.json());

// Contract addresses from .env
const CONTRACT_ADDRESSES = {
    sepolia: {
        vault: process.env.ETH_LOCK_VAULT_ADDR,
        chainId: 11155111
    },
    bsc: {
        bridge: process.env.BSC_BRIDGE_ADDRESS,
        token: process.env.BSC_TOKEN_ADDRESS,
        chainId: 97
    }
};

console.log('📝 Contract Addresses:', CONTRACT_ADDRESSES);

// Merkle tree storage
let lockMerkleTree = null;
let burnMerkleTree = null;
let lockLeaves = [];
let burnLeaves = [];

// Provider setup
const sepoliaProvider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
const bscProvider = new ethers.JsonRpcProvider(process.env.BSC_TESTNET_RPC_URL);

// Contract ABIs - Updated to match your actual contracts
const LOCK_TAG = ethers.keccak256(ethers.toUtf8Bytes("LOCK_VAULT_ETH_v1"));
const BURN_TAG = ethers.keccak256(ethers.toUtf8Bytes("BURN_VAULT_BSC_v1"));

const vaultABI = [
    "event Locked(bytes32 indexed lockId, address indexed sender, address indexed to, uint256 amount, uint256 nonce, uint256 timestamp, uint256 srcChainId, uint256 dstChainId)",
    "event Unlocked(bytes32 indexed burnId, address indexed to, uint256 amount)",
    "event MerkleRootUpdated(bytes32 merkleRoot, uint256 timestamp)",
    "function lockETH(address to, uint256 dstChainId) payable returns (bytes32)",
    "function updateMerkleRoot(bytes32 _root) external",
    "function unlockETH(bytes32 burnId, address to, uint256 amount, uint256 bscChainId, uint256 burnNonce, uint256 burnTimestamp, address originBscContract, address burner, bytes32[] calldata proof) external"
];

const bridgeABI = [
    "event MintedFromSepolia(bytes32 indexed lockId, address indexed sepoliaSender, address indexed to, uint256 amount)",
    "event MerkleRootUpdated(bytes32 merkleRoot, uint256 timestamp)",
    "function mintFromSepolia(bytes32 lockId, address sepoliaSender, address to, uint256 amount, uint256 lockNonce, uint256 lockTimestamp, bytes32[] calldata proof) external",
    "function updateMerkleRoot(bytes32 _root) external"
];

const wrappedTokenABI = [
    "event Burned(bytes32 indexed burnId, address indexed burner, address indexed to, uint256 amount, uint256 nonce, uint256 timestamp, uint256 srcChainId, uint256 dstChainId)",
    "event Minted(bytes32 indexed mintId, address indexed to, uint256 amount)",
    "function burnForSepolia(address to, uint256 dstChainId) returns (bytes32)",
    "function balanceOf(address account) view returns (uint256)"
];

// Initialize merkle trees
function initializeMerkleTrees() {
    lockMerkleTree = new MerkleTree([], keccak256, { hashLeaves: false, sortPairs: true });
    burnMerkleTree = new MerkleTree([], keccak256, { hashLeaves: false, sortPairs: true });
    lockLeaves = [];
    burnLeaves = [];
    console.log("✅ Merkle trees initialized");
}

// Build lock leaf (matches contract's calculateBurnLeaf logic)
function buildLockLeaf(lockData) {
    const leaf = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ["bytes32", "address", "bytes32", "address", "address", "uint256", "uint256", "uint256", "uint256", "uint256"],
            [
                LOCK_TAG,
                lockData.originEthVault,
                lockData.lockId,
                lockData.sender,
                lockData.to,
                lockData.amount,
                lockData.nonce,
                lockData.timestamp,
                lockData.srcChainId,
                lockData.dstChainId
            ]
        )
    );
    return leaf;
}

// Build burn leaf (matches contract's calculateBurnLeaf logic)
function buildBurnLeaf(burnData) {
    const leaf = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ["bytes32", "address", "bytes32", "address", "address", "uint256", "uint256", "uint256", "uint256", "uint256"],
            [
                BURN_TAG,
                burnData.originBscContract,
                burnData.burnId,
                burnData.burner,
                burnData.to,
                burnData.amount,
                burnData.nonce,
                burnData.timestamp,
                burnData.srcChainId,
                burnData.dstChainId
            ]
        )
    );
    return leaf;
}

// Add lock to merkle tree
function addLockToMerkleTree(lockData) {
    const leaf = buildLockLeaf(lockData);

    // Check if leaf already exists
    if (!lockLeaves.find(l => l === leaf)) {
        lockLeaves.push(leaf);
    }

    lockMerkleTree = new MerkleTree(lockLeaves, keccak256, { hashLeaves: false, sortPairs: true });

    return {
        root: lockMerkleTree.getHexRoot(),
        proof: lockMerkleTree.getHexProof(leaf),
        leaf: leaf
    };
}

// Add burn to merkle tree
function addBurnToMerkleTree(burnData) {
    const leaf = buildBurnLeaf(burnData);

    // Check if leaf already exists
    if (!burnLeaves.find(l => l === leaf)) {
        burnLeaves.push(leaf);
    }

    burnMerkleTree = new MerkleTree(burnLeaves, keccak256, { hashLeaves: false, sortPairs: true });

    return {
        root: burnMerkleTree.getHexRoot(),
        proof: burnMerkleTree.getHexProof(leaf),
        leaf: leaf
    };
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        networks: {
            sepolia: CONTRACT_ADDRESSES.sepolia.chainId,
            bsc: CONTRACT_ADDRESSES.bsc.chainId
        },
        contracts: CONTRACT_ADDRESSES
    });
});

// Get contract addresses
app.get('/api/contracts', (req, res) => {
    res.json(CONTRACT_ADDRESSES);
});

// Get current merkle roots
app.get('/api/merkle-roots', (req, res) => {
    res.json({
        lockMerkleRoot: lockMerkleTree ? lockMerkleTree.getHexRoot() : "0x",
        burnMerkleRoot: burnMerkleTree ? burnMerkleTree.getHexRoot() : "0x",
        lockLeavesCount: lockLeaves.length,
        burnLeavesCount: burnLeaves.length
    });
});

// Lock event webhook - Called when ETH is locked on Sepolia
app.post('/api/webhook/lock', async (req, res) => {
    try {
        const eventData = req.body;
        console.log("\n🔒 Lock event received:", eventData);

        // 1. Build lock data
        const lockData = {
            lockId: eventData.lockId,
            originEthVault: CONTRACT_ADDRESSES.sepolia.vault,
            sender: eventData.sender,
            to: eventData.to,
            amount: BigInt(eventData.amount),
            nonce: BigInt(eventData.nonce),
            timestamp: BigInt(eventData.timestamp),
            srcChainId: BigInt(11155111), // Sepolia
            dstChainId: BigInt(97) // BSC
        };

        // 2. Add to Merkle Tree
        const proofData = addLockToMerkleTree(lockData);
        console.log("📊 Lock Merkle root updated:", proofData.root);
        console.log("📊 Total lock leaves:", lockLeaves.length);

        // 3. Setup Relayer Wallet for BSC
        const relayerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, bscProvider);
        const bridgeContract = new ethers.Contract(
            CONTRACT_ADDRESSES.bsc.bridge,
            bridgeABI,
            relayerWallet
        );

        // 4. Update Merkle Root on BSC
        console.log("🔄 Updating Merkle root on BSC...");
        const updateTx = await bridgeContract.updateMerkleRoot(proofData.root);
        console.log("📤 Update Merkle Root TX sent:", updateTx.hash);
        await updateTx.wait();
        console.log("✅ Merkle Root updated on BSC");

        // 5. Mint Tokens on BSC
        console.log("🪙 Minting tokens on BSC...");
        const mintTx = await bridgeContract.mintFromSepolia(
            lockData.lockId,
            lockData.sender,
            lockData.to,
            lockData.amount,
            lockData.nonce,
            lockData.timestamp,
            proofData.proof
        );
        console.log("📤 Mint TX sent:", mintTx.hash);
        const mintReceipt = await mintTx.wait();
        console.log("✅ Tokens minted successfully on BSC");

        res.json({
            success: true,
            message: "Lock event processed and tokens minted",
            lockId: eventData.lockId,
            mintTxHash: mintTx.hash,
            merkleRoot: proofData.root
        });
    } catch (error) {
        console.error("❌ Error processing lock event:", error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Burn event webhook - Called when tokens are burned on BSC
app.post('/api/webhook/burn', async (req, res) => {
    try {
        const eventData = req.body;
        console.log("\n🔥 Burn event received:", eventData);

        // 1. Build burn data
        const burnData = {
            burnId: eventData.burnId,
            originBscContract: CONTRACT_ADDRESSES.bsc.token,
            burner: eventData.burner,
            to: eventData.to,
            amount: BigInt(eventData.amount),
            nonce: BigInt(eventData.nonce),
            timestamp: BigInt(eventData.timestamp),
            srcChainId: BigInt(97), // BSC
            dstChainId: BigInt(11155111) // Sepolia
        };

        // 2. Add to Merkle Tree
        const proofData = addBurnToMerkleTree(burnData);
        console.log("📊 Burn Merkle root updated:", proofData.root);
        console.log("📊 Total burn leaves:", burnLeaves.length);

        // 3. Setup Relayer Wallet for Sepolia
        const relayerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, sepoliaProvider);
        const vaultContract = new ethers.Contract(
            CONTRACT_ADDRESSES.sepolia.vault,
            vaultABI,
            relayerWallet
        );

        // 4. Update Merkle Root on Sepolia
        console.log("🔄 Updating Merkle root on Sepolia...");
        const updateTx = await vaultContract.updateMerkleRoot(proofData.root);
        console.log("📤 Update Merkle Root TX sent:", updateTx.hash);
        await updateTx.wait();
        console.log("✅ Merkle Root updated on Sepolia");

        // 5. Unlock ETH on Sepolia
        console.log("🔓 Unlocking ETH on Sepolia...");
        const unlockTx = await vaultContract.unlockETH(
            burnData.burnId,
            burnData.to,
            burnData.amount,
            burnData.srcChainId, // BSC chain ID
            burnData.nonce,
            burnData.timestamp,
            burnData.originBscContract,
            burnData.burner,
            proofData.proof
        );
        console.log("📤 Unlock TX sent:", unlockTx.hash);
        await unlockTx.wait();
        console.log("✅ ETH unlocked successfully on Sepolia");

        res.json({
            success: true,
            message: "Burn event processed and ETH unlocked",
            burnId: eventData.burnId,
            unlockTxHash: unlockTx.hash,
            merkleRoot: proofData.root
        });
    } catch (error) {
        console.error("❌ Error processing burn event:", error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🌉 Bridge Backend running on port ${PORT}`);
    console.log(`📡 Sepolia RPC: ${process.env.SEPOLIA_RPC_URL?.substring(0, 50)}...`);
    console.log(`📡 BSC RPC: ${process.env.BSC_TESTNET_RPC_URL?.substring(0, 50)}...`);
    initializeMerkleTrees();
});