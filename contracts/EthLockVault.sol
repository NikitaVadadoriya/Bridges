// File: EthLockVault.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract EthLockVault is Ownable(msg.sender), ReentrancyGuard {
    // Events
    event Locked(
        bytes32 indexed lockId,
        address indexed sender,
        address indexed to,
        uint256 amount,
        uint256 nonce,
        uint256 timestamp,
        uint256 srcChainId,
        uint256 dstChainId
    );
    event Unlocked(bytes32 indexed burnId, address indexed to, uint256 amount);
    event MerkleRootUpdated(bytes32 merkleRoot, uint256 timestamp);

    // State
    mapping(bytes32 => bool) public lockProcessed; // marks on-chain locks recorded
    mapping(bytes32 => bool) public burnProcessed; // marks burns (from other chain) already used to unlock
    uint256 public nonce;

    // Merkle root used to verify BSC-side burns when unlocking on ETH
    bytes32 public merkleRoot;
    uint256 public merkleRootTimestamp;

    // Chain ids
    uint256 public immutable thisChainId;

    // Tag constants to bind messages to schema and avoid ambiguity
    bytes32 private constant LOCK_TAG = keccak256("LOCK_VAULT_ETH_v1");
    bytes32 private constant BURN_TAG = keccak256("BURN_VAULT_BSC_v1");

    constructor(uint256 _thisChainId) {
        thisChainId = _thisChainId;
        nonce = 1;
    }

    // --- LOCK (origin chain: ETH) ---
    function lockETH(
        address to,
        uint256 dstChainId
    ) external payable nonReentrant returns (bytes32) {
        require(msg.value > 0, "No ETH sent");
        uint256 ts = block.timestamp;

        bytes32 lockId = keccak256(
            abi.encode(
                LOCK_TAG,
                address(this),
                thisChainId,
                dstChainId,
                msg.sender,
                to,
                msg.value,
                nonce,
                ts
            )
        );

        // Mark on-chain lock recorded (prevents reuse of same on-chain lock)
        lockProcessed[lockId] = true;

        emit Locked(
            lockId,
            msg.sender,
            to,
            msg.value,
            nonce,
            ts,
            thisChainId,
            dstChainId
        );

        nonce++;
        return lockId;
    }

    // --- UNLOCK (called when a burn on BSC is proven) ---
    // proof is the Merkle proof that the burn leaf is included in the latest merkleRoot
    // burn payload fields must match the values used to compute burnId on BSC
    function unlockETH(
        bytes32 burnId,
        address to,
        uint256 amount,
        uint256 bscChainId,
        uint256 burnNonce,
        uint256 burnTimestamp,
        address originBscContract,
        address burner,
        bytes32[] calldata proof
    ) external nonReentrant {
        require(merkleRoot != bytes32(0), "Merkle root not set");
        require(!burnProcessed[burnId], "Burn already processed");

        // Recreate the calculated burnId (must match the BSC-side computed burnId)
        bytes32 calculatedBurnId = keccak256(
            abi.encode(
                BURN_TAG,
                originBscContract,
                bscChainId,
                thisChainId,
                burner, // on BSC the burner is msg.sender there; here we use the passed burner address
                to,
                amount,
                burnNonce,
                burnTimestamp
            )
        );

        require(calculatedBurnId == burnId, "BURN_ID_MISMATCH");

        // Build the same leaf that the aggregator used when creating merkle tree
        bytes32 leaf = keccak256(
            abi.encode(
                BURN_TAG,
                originBscContract,
                burnId,
                burner, // Use the passed burner address, not msg.sender
                to,
                amount,
                burnNonce,
                burnTimestamp,
                bscChainId,
                thisChainId
            )
        );

        // Verify proof
        bool ok = MerkleProof.verify(proof, merkleRoot, leaf);
        require(ok, "Invalid burn proof");

        // Mark processed and transfer ETH
        burnProcessed[burnId] = true;
        (bool sent, ) = to.call{value: amount}("");
        require(sent, "ETH transfer failed");

        emit Unlocked(burnId, to, amount);
    }

    // Owner-only setter for merkle root. Replace owner with multisig/timelock in production.
    function updateMerkleRoot(bytes32 _root) external onlyOwner {
        merkleRoot = _root;
        merkleRootTimestamp = block.timestamp;
        emit MerkleRootUpdated(_root, block.timestamp);
    }

    // Helpers (view)
    function calculateLockId(
        address originContract,
        uint256 srcChainId,
        uint256 dstChainId,
        address sender,
        address recipient,
        uint256 amount,
        uint256 _nonce,
        uint256 ts
    ) public pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    LOCK_TAG,
                    originContract,
                    srcChainId,
                    dstChainId,
                    sender,
                    recipient,
                    amount,
                    _nonce,
                    ts
                )
            );
    }

    function calculateBurnLeaf(
        address originBscContract,
        bytes32 _burnId,
        address burner,
        address recipient,
        uint256 amount,
        uint256 _nonce,
        uint256 ts,
        uint256 srcChainId,
        uint256 dstChainId
    ) public pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    BURN_TAG,
                    originBscContract,
                    _burnId,
                    burner,
                    recipient,
                    amount,
                    _nonce,
                    ts,
                    srcChainId,
                    dstChainId
                )
            );
    }
}
