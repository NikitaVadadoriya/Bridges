// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract WrappedEthOnBSC is ERC20, Ownable(msg.sender) {
    event Burned(bytes32 indexed burnId, address indexed burner, address indexed to, uint256 amount, uint256 nonce, uint256 timestamp, uint256 srcChainId, uint256 dstChainId);
    event Minted(bytes32 indexed mintId, address indexed to, uint256 amount);

    mapping(bytes32 => bool) public processedMints;

    uint256 public nonce;
    uint256 public immutable thisChainId;

    bytes32 private constant BURN_TAG = keccak256("BURN_VAULT_BSC_v1");
    bytes32 private constant LOCK_TAG = keccak256("LOCK_VAULT_ETH_v1");

    constructor(string memory name_, string memory symbol_, uint256 _thisChainId) ERC20(name_, symbol_) {
        thisChainId = _thisChainId;
        nonce = 1;
    }

    // Simple mint callable by owner (bridge) — in production restrict to bridge contract address
    function mint(address to, uint256 amount, bytes32 mintId) external onlyOwner {
        require(!processedMints[mintId], "Already minted");
        processedMints[mintId] = true;
        _mint(to, amount);
        emit Minted(mintId, to, amount);
    }

    // Burn to request unlocking on origin chain
    function burnForSepolia(address to, uint256 dstChainId, uint256 amount) external returns (bytes32) {
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        uint256 ts = block.timestamp;

        // Burn the specified amount
        _burn(msg.sender, amount);

        bytes32 burnId = keccak256(
            abi.encode(
                BURN_TAG,
                address(this),
                thisChainId,
                dstChainId,
                msg.sender,
                to,
                amount,
                nonce,
                ts
            )
        );

        emit Burned(burnId, msg.sender, to, amount, nonce, ts, thisChainId, dstChainId);

        nonce++;
        return burnId;
    }

    // Helper used by bridge when proving lock -> mint
    function calculateLockLeaf(
        address originEthContract,
        bytes32 _lockId,
        address sender,
        address recipient,
        uint256 amount,
        uint256 _nonce,
        uint256 ts,
        uint256 srcChainId,
        uint256 dstChainId
    ) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                LOCK_TAG,
                originEthContract,
                _lockId,
                sender,
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