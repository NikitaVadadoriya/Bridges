
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

interface IWrappedEthOnBSC {
    function mint(address to, uint256 amount, bytes32 mintId) external;
}

contract BridgeBSC is Ownable(msg.sender) {
    event MintedFromSepolia(bytes32 indexed lockId, address indexed sepoliaSender, address indexed to, uint256 amount);
    event MerkleRootUpdated(bytes32 merkleRoot, uint256 timestamp);

    bytes32 public merkleRoot;
    uint256 public merkleRootTimestamp;

    // Addresses
    address public originEthVault; // address of EthLockVault on origin chain (for leaf binding)
    IWrappedEthOnBSC public wrapped;

    mapping(bytes32 => bool) public processedLocks; // prevent double mint

    uint256 public immutable thisChainId;
    uint256 public immutable sepoliaChainId;

    bytes32 private constant LOCK_TAG = keccak256("LOCK_VAULT_ETH_v1");

    constructor(address _wrapped, address _originEthVault, uint256 _thisChainId, uint256 _sepoliaChainId) {
        wrapped = IWrappedEthOnBSC(_wrapped);
        originEthVault = _originEthVault;
        thisChainId = _thisChainId;
        sepoliaChainId = _sepoliaChainId;
    }

    // Owner should replace with multisig in production
    function updateMerkleRoot(bytes32 _root) external onlyOwner {
        merkleRoot = _root;
        merkleRootTimestamp = block.timestamp;
        emit MerkleRootUpdated(_root, block.timestamp);
    }

    // Mint on BSC after verifying the lock proof from Sepolia
    function mintFromSepolia(
        bytes32 lockId,
        address sepoliaSender,
        address to,
        uint256 amount,
        uint256 lockNonce,
        uint256 lockTimestamp,
        bytes32[] calldata proof
    ) external {
        require(merkleRoot != bytes32(0), "Merkle root not set");
        require(!processedLocks[lockId], "Lock already processed");

        // Recreate calculatedLockId the same way origin chain created it
        bytes32 calculatedLockId = keccak256(
            abi.encode(
                LOCK_TAG,
                originEthVault,
                sepoliaChainId,
                thisChainId,
                sepoliaSender,
                to,
                amount,
                lockNonce,
                lockTimestamp
            )
        );

        require(calculatedLockId == lockId, "LOCK_ID_MISMATCH");

        // Build leaf used in Merkle tree
        bytes32 leaf = keccak256(
            abi.encode(
                LOCK_TAG,
                originEthVault,
                lockId,
                sepoliaSender,
                to,
                amount,
                lockNonce,
                lockTimestamp,
                sepoliaChainId,
                thisChainId
            )
        );

        bool ok = MerkleProof.verify(proof, merkleRoot, leaf);
        require(ok, "Invalid lock proof");

        // Mark processed then mint
        processedLocks[lockId] = true;

        // Use lockId as mintId so it's unique and bound to origin
        wrapped.mint(to, amount, lockId);

        emit MintedFromSepolia(lockId, sepoliaSender, to, amount);
    }

    // Owner functions to update addresses
    function setOriginEthVault(address _addr) external onlyOwner {
        originEthVault = _addr;
    }

    function setWrapped(address _wrapped) external onlyOwner {
        wrapped = IWrappedEthOnBSC(_wrapped);
    }
}
