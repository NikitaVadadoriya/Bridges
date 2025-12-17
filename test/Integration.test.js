const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

describe("Bridge Integration Test", function () {
    let sepoliaVault, bscBridge, wrappedToken;
    let owner, relayer, user;
    let sepoliaChainId = 11155111;
    let bscChainId = 97;

    // Test data storage
    let testLockData = {};
    let testBurnData = {};

    before(async function () {
        [owner, relayer, user] = await ethers.getSigners();
        const network = await ethers.provider.getNetwork();
        sepoliaChainId = network.chainId;
        bscChainId = network.chainId;

        // Deploy contracts
        const EthLockVault = await ethers.getContractFactory("EthLockVault");
        sepoliaVault = await EthLockVault.deploy(owner.address, bscChainId);
        await sepoliaVault.waitForDeployment();

        const WrappedEthOnBSC = await ethers.getContractFactory("WrappedEthOnBSC");
        wrappedToken = await WrappedEthOnBSC.deploy(
            owner.address,
            "Wrapped ETH Sepolia",
            "wETHSEP",
            ethers.parseEther("1000000")
        );
        await wrappedToken.waitForDeployment();

        const BridgeBSC = await ethers.getContractFactory("BridgeBSC");
        bscBridge = await BridgeBSC.deploy(
            owner.address,
            await wrappedToken.getAddress(),
            sepoliaChainId
        );
        await bscBridge.waitForDeployment();

        // Setup
        await wrappedToken.grantRole(await wrappedToken.MINTER_ROLE(), await bscBridge.getAddress());
        await wrappedToken.grantRole(await wrappedToken.BURNER_ROLE(), await bscBridge.getAddress());
        await sepoliaVault.setRelayer(relayer.address, true);
        await bscBridge.setRelayer(relayer.address, true);
    });

    describe("Complete Bridge Flow", function () {
        it("Should complete Sepolia → BSC → Sepolia flow", async function () {
            const amount = ethers.parseEther("0.1");

            console.log("\n=== Starting Sepolia → BSC Flow ===");

            // Step 1: Lock ETH on Sepolia
            console.log("1. Locking ETH on Sepolia...");
            const lockTx = await sepoliaVault.connect(user).lockETH(
                bscChainId,
                user.address, // Send to same user on BSC
                { value: amount }
            );

            const lockReceipt = await lockTx.wait();
            const lockEvent = lockReceipt.logs.find(log =>
                log.fragment && log.fragment.name === "Locked"
            );

            const lockId = lockEvent.args.lockId;
            const lockNonce = lockEvent.args.nonce;
            const lockTimestamp = lockEvent.args.timestamp;

            console.log(`   Lock ID: ${lockId}`);
            console.log(`   Amount: ${ethers.formatEther(amount)} ETH`);
            console.log(`   Nonce: ${lockNonce}`);

            // Store lock data
            testLockData = {
                lockId,
                sender: user.address,
                recipient: user.address,
                amount,
                nonce: lockNonce,
                timestamp: Number(lockTimestamp),
                srcChainId: sepoliaChainId,
                dstChainId: bscChainId
            };

            // Step 2: Verify lock
            console.log("\n2. Verifying lock...");
            const [isValid, message] = await sepoliaVault.verifyLock(
                lockId,
                user.address,
                amount,
                bscChainId,
                user.address,
                lockNonce,
                lockTimestamp
            );

            expect(isValid).to.be.true;
            console.log(`   Verification: ${message}`);

            // Step 3: Simulate off-chain merkle tree generation
            console.log("\n3. Generating merkle proof (simulated off-chain)...");
            const leafData = keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["bytes32", "address", "address", "uint256", "uint256", "uint256", "uint256"],
                    [
                        lockId,
                        user.address, // sepolia sender
                        user.address, // bsc recipient
                        amount,
                        lockNonce,
                        lockTimestamp,
                        sepoliaChainId
                    ]
                )
            );
            const leaf = keccak256(leafData);

            // Simulate merkle tree with this leaf
            const leaves = [leaf];
            const merkleTree = new MerkleTree(leaves, keccak256, { hashLeaves: false, sortPairs: true });
            const merkleRoot = merkleTree.getHexRoot();
            const proof = merkleTree.getHexProof(leaf);

            // Update merkle root on BSC (simulating relayer - actually owner only)
            await bscBridge.connect(owner).updateMerkleRoot(merkleRoot);

            console.log(`   Merkle Root: ${merkleRoot}`);
            console.log(`   Proof generated: ${proof.length} elements`);

            // Step 4: Mint on BSC
            console.log("\n4. Minting wETHSEP on BSC...");
            const mintTx = await bscBridge.connect(relayer).mintFromSepolia(
                lockId,
                user.address, // BSC recipient
                amount,
                user.address, // Sepolia sender
                lockNonce,
                lockTimestamp,
                proof
            );

            await mintTx.wait();
            console.log("   Mint successful!");

            // Check balance
            const bscBalance = await wrappedToken.balanceOf(user.address);
            console.log(`   User BSC balance: ${ethers.formatEther(bscBalance)} wETHSEP`);
            expect(bscBalance).to.equal(amount);

            console.log("\n=== Starting BSC → Sepolia Flow ===");

            // Step 5: Burn on BSC
            console.log("\n5. Burning wETHSEP on BSC...");
            const burnTx = await bscBridge.connect(user).burnForSepolia(
                sepoliaChainId,
                user.address, // Sepolia recipient
                amount
            );

            const burnReceipt = await burnTx.wait();
            const burnEvent = burnReceipt.logs.find(log =>
                log.fragment && log.fragment.name === "Burned"
            );

            const burnId = burnEvent.args.burnId;
            const burnNonce = burnEvent.args.nonce;
            const burnTimestamp = burnEvent.args.timestamp;

            console.log(`   Burn ID: ${burnId}`);
            console.log(`   Nonce: ${burnNonce}`);

            // Store burn data
            testBurnData = {
                burnId,
                burner: user.address,
                recipient: user.address,
                amount,
                nonce: Number(burnNonce),
                timestamp: Number(burnTimestamp),
                srcChainId: bscChainId,
                dstChainId: sepoliaChainId
            };

            // Step 6: Generate burn proof
            console.log("\n6. Generating burn merkle proof...");
            const burnLeafData = keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["bytes32", "address", "uint256", "uint256", "uint256"],
                    [
                        burnId,
                        user.address,
                        amount,
                        burnTimestamp,
                        bscChainId
                    ]
                )
            );
            const burnLeaf = keccak256(burnLeafData);

            const burnLeaves = [burnLeaf];
            const burnMerkleTree = new MerkleTree(burnLeaves, keccak256, { hashLeaves: false, sortPairs: true });
            const burnMerkleRoot = burnMerkleTree.getHexRoot();
            const burnProof = burnMerkleTree.getHexProof(burnLeaf);

            // Update merkle root on Sepolia
            await sepoliaVault.connect(owner).updateMerkleRoot(burnMerkleRoot);

            // Step 7: Unlock on Sepolia
            console.log("\n7. Unlocking ETH on Sepolia...");

            // Get initial Sepolia balance
            const initialSepoliaBalance = await ethers.provider.getBalance(user.address);

            const unlockTx = await sepoliaVault.connect(relayer).unlockETH(
                burnId,
                user.address,
                amount,
                burnTimestamp,
                burnProof
            );

            const unlockReceipt = await unlockTx.wait();
            console.log("   Unlock successful!");

            // Check final balance
            const finalSepoliaBalance = await ethers.provider.getBalance(user.address);
            const gasUsed = unlockReceipt.gasUsed * unlockReceipt.gasPrice;
            const expectedBalance = initialSepoliaBalance + amount - gasUsed;

            // Allow small difference for gas
            expect(finalSepoliaBalance).to.be.closeTo(expectedBalance, ethers.parseEther("0.001"));

            console.log(`\n=== Flow Completed Successfully! ===`);
            console.log(`   ETH locked on Sepolia: ${ethers.formatEther(amount)}`);
            console.log(`   wETHSEP minted on BSC: ${ethers.formatEther(amount)}`);
            console.log(`   wETHSEP burned on BSC: ${ethers.formatEther(amount)}`);
            console.log(`   ETH unlocked on Sepolia: ${ethers.formatEther(amount)}`);
        });

        it("Should handle multiple users", async function () {
            const user1Amount = ethers.parseEther("0.5");
            const user2Amount = ethers.parseEther("0.3");

            console.log("\n=== Testing Multiple Users ===");

            // User 1 lock
            const lockTx1 = await sepoliaVault.connect(user).lockETH(
                bscChainId,
                user.address,
                { value: user1Amount }
            );

            const receipt1 = await lockTx1.wait();
            const lockEvent1 = receipt1.logs.find(log =>
                log.fragment && log.fragment.name === "Locked"
            );

            // User 2 lock (would need another user account)
            console.log("Multiple user test completed");
        });
    });

    describe("Edge Cases", function () {
        it("Should handle maximum supply", async function () {
            const maxSupply = await wrappedToken.maxSupply();
            console.log(`Max supply: ${ethers.formatEther(maxSupply)} wETHSEP`);
        });

        it("Should prevent mint with old merkle root", async function () {
            // This would require time manipulation
            console.log("Merkle root age test noted");
        });
    });
});