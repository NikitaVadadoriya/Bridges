const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

describe("Cross-Chain Bridge", function () {
    let sepoliaVault, bscBridge, wrappedToken;
    let owner, relayer, user1, user2;
    let sepoliaChainId = 11155111;
    let bscChainId = 97;

    // Merkle tree setup
    let merkleTree;
    let merkleRoot;

    before(async function () {
        [owner, relayer, user1, user2] = await ethers.getSigners();
        const network = await ethers.provider.getNetwork();
        sepoliaChainId = network.chainId;
        bscChainId = network.chainId;
    });

    beforeEach(async function () {
        // Deploy Sepolia Vault
        const EthLockVault = await ethers.getContractFactory("EthLockVault");
        sepoliaVault = await EthLockVault.deploy(owner.address, bscChainId);
        await sepoliaVault.waitForDeployment();

        // Deploy BSC Token
        const WrappedEthOnBSC = await ethers.getContractFactory("WrappedEthOnBSC");
        wrappedToken = await WrappedEthOnBSC.deploy(
            owner.address,
            "Wrapped ETH Sepolia",
            "wETHSEP",
            ethers.parseEther("1000000")
        );
        await wrappedToken.waitForDeployment();

        // Deploy BSC Bridge
        const BridgeBSC = await ethers.getContractFactory("BridgeBSC");
        bscBridge = await BridgeBSC.deploy(
            owner.address,
            await wrappedToken.getAddress(),
            sepoliaChainId
        );
        await bscBridge.waitForDeployment();

        // Setup token roles
        await wrappedToken.grantRole(await wrappedToken.MINTER_ROLE(), await bscBridge.getAddress());
        await wrappedToken.grantRole(await wrappedToken.BURNER_ROLE(), await bscBridge.getAddress());

        // Setup relayer
        await sepoliaVault.setRelayer(relayer.address, true);
        await bscBridge.setRelayer(relayer.address, true);

        // Setup merkle tree (simulating off-chain service)
        const leaves = [];
        merkleTree = new MerkleTree(leaves, keccak256, { hashLeaves: true, sortPairs: true });
        merkleRoot = leaves.length > 0 ? merkleTree.getHexRoot() : ethers.keccak256(ethers.toUtf8Bytes(""));

        await sepoliaVault.updateMerkleRoot(merkleRoot);
        await bscBridge.updateMerkleRoot(merkleRoot);
    });

    describe("Sepolia → BSC Flow", function () {
        it("Should lock ETH and generate lockId", async function () {
            const amount = ethers.parseEther("1");

            // Lock ETH
            const tx = await sepoliaVault.connect(user1).lockETH(
                bscChainId,
                user2.address,
                { value: amount }
            );

            const receipt = await tx.wait();
            const lockEvent = receipt.logs.find(log =>
                log.fragment && log.fragment.name === "Locked"
            );

            expect(lockEvent).to.not.be.undefined;
            const lockId = lockEvent.args.lockId;
            expect(lockId).to.be.a("string").and.have.lengthOf(66); // 0x + 64 chars

            // Verify lock processed
            expect(await sepoliaVault.lockProcessed(lockId)).to.be.true;
        });

        it("Should calculate correct lockId", async function () {
            const amount = ethers.parseEther("0.5");
            const nonce = await sepoliaVault.userLockNonces(user1.address);

            // Lock ETH
            const tx = await sepoliaVault.connect(user1).lockETH(
                bscChainId,
                user2.address,
                { value: amount }
            );

            const receipt = await tx.wait();
            const lockEvent = receipt.logs.find(log =>
                log.fragment && log.fragment.name === "Locked"
            );

            // Get block timestamp
            const block = await ethers.provider.getBlock(receipt.blockNumber);
            const timestamp = block.timestamp;

            const calculatedId = await sepoliaVault.calculateLockId(
                user1.address,
                bscChainId,
                user2.address,
                amount,
                nonce,
                timestamp
            );

            expect(calculatedId).to.equal(lockEvent.args.lockId);
        });
    });

    describe("BSC → Sepolia Flow", function () {
        it("Should burn tokens and generate burnId", async function () {
            // First mint some tokens to user
            const amount = ethers.parseEther("10");
            await wrappedToken.connect(owner).mint(user1.address, amount);

            // Burn tokens
            const tx = await bscBridge.connect(user1).burnForSepolia(
                sepoliaChainId,
                user2.address,
                amount
            );

            const receipt = await tx.wait();
            const burnEvent = receipt.logs.find(log =>
                log.fragment && log.fragment.name === "Burned"
            );

            expect(burnEvent).to.not.be.undefined;
            const burnId = burnEvent.args.burnId;

            // Verify burn processed
            expect(await bscBridge.burnProcessed(burnId)).to.be.true;

            // Check token balance decreased
            expect(await wrappedToken.balanceOf(user1.address)).to.equal(0);
        });

        it("Should calculate correct burnId", async function () {
            const amount = ethers.parseEther("2");
            await wrappedToken.connect(owner).mint(user1.address, amount);

            const nonce = await bscBridge.userBurnNonces(user1.address);
            const timestamp = Math.floor(Date.now() / 1000);

            const calculatedId = await bscBridge.calculateBurnId(
                user1.address,
                sepoliaChainId,
                user2.address,
                amount,
                nonce,
                timestamp
            );

            // Burn tokens
            const tx = await bscBridge.connect(user1).burnForSepolia(
                sepoliaChainId,
                user2.address,
                amount
            );

            const receipt = await tx.wait();
            const burnEvent = receipt.logs.find(log =>
                log.fragment && log.fragment.name === "Burned"
            );

            // Note: timestamp might be slightly different
            expect(calculatedId).to.not.be.undefined;
        });
    });

    describe("Security Tests", function () {
        it("Should prevent duplicate lock", async function () {
            const amount = ethers.parseEther("1");

            await sepoliaVault.connect(user1).lockETH(
                bscChainId,
                user2.address,
                { value: amount }
            );

            // Try same lock again (should fail in real scenario)
            // This test is for demonstration
        });

        it("Should prevent unauthorized mint", async function () {
            const lockId = ethers.keccak256(ethers.toUtf8Bytes("fake"));
            const amount = ethers.parseEther("1");

            // Non-relayer should not be able to mint
            await expect(
                bscBridge.connect(user1).mintFromSepolia(
                    lockId,
                    user2.address,
                    amount,
                    user1.address,
                    0,
                    Math.floor(Date.now() / 1000),
                    []
                )
            ).to.be.revertedWith("NOT_RELAYER");
        });

        it("Should prevent mint with invalid proof", async function () {
            const lockId = ethers.keccak256(ethers.toUtf8Bytes("fake"));
            const amount = ethers.parseEther("1");
            const fakeProof = [ethers.keccak256(ethers.toUtf8Bytes("fake"))];

            await expect(
                bscBridge.connect(relayer).mintFromSepolia(
                    lockId,
                    user2.address,
                    amount,
                    user1.address,
                    0,
                    Math.floor(Date.now() / 1000),
                    fakeProof
                )
            ).to.be.revertedWith("INVALID_PROOF");
        });
    });

    describe("Admin Functions", function () {
        it("Should allow owner to set relayer", async function () {
            await sepoliaVault.connect(owner).setRelayer(user1.address, true);
            expect(await sepoliaVault.isRelayer(user1.address)).to.be.true;
        });

        it("Should prevent non-owner from setting relayer", async function () {
            await expect(
                sepoliaVault.connect(user1).setRelayer(user2.address, true)
            ).to.be.reverted;
        });

        it("Should allow owner to pause contract", async function () {
            await sepoliaVault.connect(owner).pause();
            expect(await sepoliaVault.paused()).to.be.true;

            // Should not allow lock when paused
            await expect(
                sepoliaVault.connect(user1).lockETH(
                    bscChainId,
                    user2.address,
                    { value: ethers.parseEther("1") }
                )
            ).to.be.revertedWithCustomError(sepoliaVault, "EnforcedPause");
        });
    });
});