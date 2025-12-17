import React, { useState, useEffect } from 'react';
import {
    Container,
    Typography,
    Box,
    Card,
    CardContent,
    TextField,
    Button,
    Grid,
    Alert,
    Tabs,
    Tab,
    CircularProgress,
    Paper,
    Chip
} from '@mui/material';
import { ethers } from 'ethers';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3002/api';

// Contract ABIs - Updated to match deployed contracts
const vaultABI = [
    "function lockETH(address to, uint256 dstChainId) payable returns (bytes32)",
    "event Locked(bytes32 indexed lockId, address indexed sender, address indexed to, uint256 amount, uint256 nonce, uint256 timestamp, uint256 srcChainId, uint256 dstChainId)"
];

const wrappedTokenABI = [
    "function burnForSepolia(address to, uint256 dstChainId, uint256 amount) returns (bytes32)",
    "function balanceOf(address account) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "event Burned(bytes32 indexed burnId, address indexed burner, address indexed to, uint256 amount, uint256 nonce, uint256 timestamp, uint256 srcChainId, uint256 dstChainId)"
];

function App() {
    const [tabValue, setTabValue] = useState(0);
    const [account, setAccount] = useState('');
    const [chainId, setChainId] = useState('');
    const [isConnected, setIsConnected] = useState(false);

    // Lock form state
    const [lockAmount, setLockAmount] = useState('');
    const [lockRecipient, setLockRecipient] = useState('');
    const [lockStatus, setLockStatus] = useState('');
    const [lockId, setLockId] = useState('');

    // Burn form state
    const [burnAmount, setBurnAmount] = useState('');
    const [burnRecipient, setBurnRecipient] = useState('');
    const [burnStatus, setBurnStatus] = useState('');
    const [burnId, setBurnId] = useState('');
    const [tokenBalance, setTokenBalance] = useState('0');

    // Loading states
    const [loading, setLoading] = useState(false);

    // Contract addresses
    const [contracts, setContracts] = useState({
        sepolia: { vault: '', chainId: 11155111 },
        bsc: { bridge: '', token: '', chainId: 97 }
    });

    useEffect(() => {
        // Load contract addresses from API
        axios.get(`${API_BASE_URL}/contracts`)
            .then(response => {
                console.log('📝 Loaded contracts:', response.data);
                setContracts(response.data);
            })
            .catch(error => {
                console.error('Error loading contracts:', error);
            });

        // Check if wallet is already connected
        checkConnection();

        // Listen for account changes
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', () => window.location.reload());
        }

        return () => {
            if (window.ethereum) {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            }
        };
    }, []);

    // Update token balance when on BSC
    useEffect(() => {
        if (isConnected && chainId === '97' && contracts.bsc.token) {
            updateTokenBalance();
        }
    }, [isConnected, chainId, contracts.bsc.token, account]);

    const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
            setIsConnected(false);
            setAccount('');
        } else {
            setAccount(accounts[0]);
            checkConnection();
        }
    };

    const updateTokenBalance = async () => {
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const tokenContract = new ethers.Contract(
                contracts.bsc.token,
                wrappedTokenABI,
                provider
            );
            const balance = await tokenContract.balanceOf(account);
            setTokenBalance(ethers.formatEther(balance));
        } catch (error) {
            console.error('Error fetching token balance:', error);
        }
    };

    const checkConnection = async () => {
        if (window.ethereum) {
            try {
                const provider = new ethers.BrowserProvider(window.ethereum);
                const accounts = await provider.send("eth_accounts", []);
                if (accounts.length > 0) {
                    setAccount(accounts[0]);
                    setIsConnected(true);

                    const network = await provider.getNetwork();
                    setChainId(network.chainId.toString());
                }
            } catch (error) {
                console.error('Error checking connection:', error);
            }
        }
    };

    const connectWallet = async () => {
        if (!window.ethereum) {
            alert('Please install MetaMask!');
            return;
        }

        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const accounts = await provider.send("eth_requestAccounts", []);
            setAccount(accounts[0]);
            setIsConnected(true);

            const network = await provider.getNetwork();
            setChainId(network.chainId.toString());

            alert('Wallet connected successfully!');
        } catch (error) {
            console.error('Error connecting wallet:', error);
            alert('Failed to connect wallet');
        }
    };

    const switchToSepolia = async () => {
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0xaa36a7' }], // Sepolia chain ID
            });
        } catch (error) {
            console.error('Error switching to Sepolia:', error);
        }
    };

    const switchToBSC = async () => {
        try {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: '0x61',
                    chainName: 'BSC Testnet',
                    nativeCurrency: {
                        name: 'BNB',
                        symbol: 'BNB',
                        decimals: 18
                    },
                    rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
                    blockExplorerUrls: ['https://testnet.bscscan.com']
                }]
            });

            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x61' }],
            });
        } catch (error) {
            console.error('Error switching to BSC:', error);
        }
    };

    const handleLockETH = async () => {
        if (!isConnected) {
            alert('Please connect your wallet first');
            return;
        }

        if (chainId !== '11155111') {
            alert('Please switch to Sepolia network');
            return;
        }

        if (parseFloat(lockAmount) <= 0) {
            alert('Please enter a valid amount');
            return;
        }


        if (parseFloat(burnAmount) <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        // if (!burnRecipient || !ethers.isAddress(burnRecipient)) {
        //     alert('Please enter a valid BSC recipient address');
        //     return;
        // }

        try {
            setLoading(true);
            setLockStatus('🔄 Initiating lock...');

            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();

            const vaultAddress = contracts.sepolia.vault;
            if (!vaultAddress || vaultAddress === "0x...") {
                throw new Error("Invalid vault address. Please check backend configuration.");
            }

            const vaultContract = new ethers.Contract(vaultAddress, vaultABI, signer);

            // Convert amount to wei
            const amountWei = ethers.parseEther(lockAmount);
            const bscChainId = 97; // BSC Testnet

            console.log(`🔒 Locking ${lockAmount} ETH for recipient ${lockRecipient}`);

            // Call lockETH
            const tx = await vaultContract.lockETH(
                lockRecipient,
                bscChainId,
                { value: amountWei }
            );

            console.log("📤 Transaction sent:", tx.hash);
            setLockStatus('⏳ Waiting for confirmation...');

            const receipt = await tx.wait();
            console.log("✅ Transaction confirmed:", receipt);
            setLockStatus('🔍 Processing event...');

            // Parse logs to get lockId
            const lockEvent = receipt.logs.find(log => {
                try {
                    const parsed = vaultContract.interface.parseLog(log);
                    return parsed && parsed.name === 'Locked';
                } catch {
                    return false;
                }
            });

            if (lockEvent) {
                const parsedLog = vaultContract.interface.parseLog(lockEvent);
                const eventLockId = parsedLog.args.lockId;
                const timestamp = parsedLog.args.timestamp;
                const nonce = parsedLog.args.nonce;
                const sender = parsedLog.args.sender;
                const to = parsedLog.args.to;

                setLockId(eventLockId);
                console.log("🔑 Lock ID:", eventLockId);
                console.log("📊 Event data:", {
                    sender,
                    to,
                    amount: amountWei.toString(),
                    nonce: nonce.toString(),
                    timestamp: timestamp.toString()
                });

                // Notify backend
                setLockStatus('📡 Notifying backend...');
                const backendResponse = await axios.post(`${API_BASE_URL}/webhook/lock`, {
                    lockId: eventLockId,
                    sender: sender,
                    to: to,
                    amount: amountWei.toString(),
                    nonce: nonce.toString(),
                    timestamp: timestamp.toString()
                });

                console.log("✅ Backend response:", backendResponse.data);
                setLockStatus(`✅ Success! Tokens will be minted on BSC. TX: ${backendResponse.data.mintTxHash?.substring(0, 16)}...`);
            } else {
                console.error("❌ Failed to find Locked event");
                setLockStatus('❌ Failed to parse lock event');
            }

        } catch (error) {
            console.error('❌ Error locking ETH:', error);
            setLockStatus(`❌ Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleBurnTokens = async () => {
        if (!isConnected) {
            alert('Please connect your wallet first');
            return;
        }

        if (chainId !== '97') {
            alert('Please switch to BSC Testnet');
            return;
        }

        if (!burnRecipient || !ethers.isAddress(burnRecipient)) {
            alert('Please enter a valid Sepolia recipient address');
            return;
        }

        if (parseFloat(burnAmount) <= 0) {
            alert('Please enter a valid burn amount');
            return;
        }

        if (parseFloat(burnAmount) > parseFloat(tokenBalance)) {
            alert('Insufficient token balance');
            return;
        }

        try {
            setLoading(true);
            setBurnStatus('🔄 Initiating burn...');

            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();

            const tokenAddress = contracts.bsc.token;
            const tokenContract = new ethers.Contract(tokenAddress, wrappedTokenABI, signer);

            const sepoliaChainId = 11155111;
            const amountWei = ethers.parseEther(burnAmount);

            console.log(`🔥 Burning ${burnAmount} tokens for recipient ${burnRecipient}`);

            // Call burnForSepolia with amount
            const tx = await tokenContract.burnForSepolia(
                burnRecipient,
                sepoliaChainId,
                amountWei
            );

            console.log("📤 Transaction sent:", tx.hash);
            setBurnStatus('⏳ Waiting for confirmation...');

            const receipt = await tx.wait();
            console.log("✅ Transaction confirmed:", receipt);
            setBurnStatus('🔍 Processing event...');

            // Parse logs to get burnId
            const burnEvent = receipt.logs.find(log => {
                try {
                    const parsed = tokenContract.interface.parseLog(log);
                    return parsed && parsed.name === 'Burned';
                } catch {
                    return false;
                }
            });

            if (burnEvent) {
                const parsedLog = tokenContract.interface.parseLog(burnEvent);
                const eventBurnId = parsedLog.args.burnId;
                const timestamp = parsedLog.args.timestamp;
                const nonce = parsedLog.args.nonce;
                const burner = parsedLog.args.burner;
                const to = parsedLog.args.to;
                const amount = parsedLog.args.amount;

                setBurnId(eventBurnId);
                console.log("🔑 Burn ID:", eventBurnId);
                console.log("📊 Event data:", {
                    burner,
                    to,
                    amount: amount.toString(),
                    nonce: nonce.toString(),
                    timestamp: timestamp.toString()
                });

                // Notify backend to unlock ETH
                setBurnStatus('📡 Notifying backend...');
                const backendResponse = await axios.post(`${API_BASE_URL}/webhook/burn`, {
                    burnId: eventBurnId,
                    burner: burner,
                    to: to,
                    amount: amount.toString(),
                    nonce: nonce.toString(),
                    timestamp: timestamp.toString()
                });

                console.log("✅ Backend response:", backendResponse.data);
                setBurnStatus(`✅ Success! ETH unlocked on Sepolia. TX: ${backendResponse.data.unlockTxHash?.substring(0, 16)}...`);

                // Update balance
                setTimeout(updateTokenBalance, 2000);
            } else {
                console.error("❌ Failed to find Burned event");
                setBurnStatus('❌ Failed to parse burn event');
            }

        } catch (error) {
            console.error('❌ Error burning tokens:', error);
            setBurnStatus(`❌ Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const TabPanel = ({ children, value, index }) => {
        return (
            <div hidden={value !== index}>
                {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
            </div>
        );
    };

    return (
        <Container maxWidth="lg" >
            <Box sx={{ my: 4 }}>
                <Typography variant="h3" component="h1" gutterBottom align="center">
                    🌉 Cross-Chain ETH Bridge
                </Typography>
                <Typography variant="subtitle1" align="center" color="text.secondary" gutterBottom>
                    Sepolia ↔ BSC Testnet
                </Typography>

                <Card sx={{ mb: 4 }}>
                    <CardContent>
                        <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} md={6}>
                                <Typography variant="h6">
                                    {isConnected ? `Connected: ${account.substring(0, 10)}...` : 'Wallet not connected'}
                                </Typography>
                                <Box sx={{ mt: 1 }}>
                                    {chainId === '11155111' && <Chip label="Sepolia" color="primary" size="small" />}
                                    {chainId === '97' && <Chip label="BSC Testnet" color="success" size="small" />}
                                    {chainId && chainId !== '11155111' && chainId !== '97' && (
                                        <Chip label={`Chain ${chainId}`} color="warning" size="small" />
                                    )}
                                </Box>
                                {chainId === '97' && (
                                    <Typography variant="body2" sx={{ mt: 1 }}>
                                        Token Balance: {parseFloat(tokenBalance).toFixed(4)} wETHbT
                                    </Typography>
                                )}
                            </Grid>
                            <Grid item xs={12} md={6} sx={{ textAlign: 'right' }}>
                                {!isConnected ? (
                                    <Button variant="contained" onClick={connectWallet}>
                                        Connect Wallet
                                    </Button>
                                ) : (
                                    <Box>
                                        {chainId !== '11155111' && (
                                            <Button variant="outlined" onClick={switchToSepolia} sx={{ mr: 2 }}>
                                                Switch to Sepolia
                                            </Button>
                                        )}
                                        {chainId !== '97' && (
                                            <Button variant="outlined" onClick={switchToBSC}>
                                                Switch to BSC
                                            </Button>
                                        )}
                                    </Box>
                                )}
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>

                <Paper sx={{ width: '100%' }}>
                    <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} centered>
                        <Tab label="Sepolia → BSC (Lock ETH)" />
                        <Tab label="BSC → Sepolia (Burn Tokens)" />
                        <Tab label="Contract Info" />
                    </Tabs>
                </Paper>

                <TabPanel value={tabValue} index={0}>
                    <Card>
                        <CardContent>
                            <Typography variant="h5" gutterBottom>
                                Lock ETH on Sepolia → Mint wETHbT on BSC
                            </Typography>
                            <Alert severity="info" sx={{ mt: 2, mb: 3 }}>
                                Make sure you're connected to Sepolia network
                            </Alert>

                            <Box component="form" sx={{ mt: 3 }}>
                                <TextField
                                    fullWidth
                                    label="Amount (ETH)"
                                    type="text"
                                    value={lockAmount}
                                    onChange={(e) => setLockAmount(e.target.value)}
                                    margin="normal"
                                    disabled={loading}
                                    inputProps={{ step: "0.001", min: "0" }}

                                />

                                <TextField
                                    fullWidth
                                    label="BSC Recipient Address"
                                    value={lockRecipient}
                                    onChange={(e) => setLockRecipient(e.target.value)}
                                    margin="normal"
                                    disabled={loading}
                                    placeholder="0x..."
                                    helperText="Address that will receive wETHbT on BSC"
                                />

                                <Button
                                    fullWidth
                                    variant="contained"
                                    onClick={handleLockETH}
                                    disabled={loading || !isConnected || chainId !== '11155111'}
                                    sx={{ mt: 2 }}
                                    size="large"
                                >
                                    {loading ? <CircularProgress size={24} /> : 'Lock ETH'}
                                </Button>

                                {lockStatus && (
                                    <Alert severity={lockStatus.includes('❌') ? 'error' : 'success'} sx={{ mt: 2 }}>
                                        {lockStatus}
                                    </Alert>
                                )}

                                {lockId && (
                                    <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                                        <Typography variant="body2">
                                            <strong>Lock ID:</strong> {lockId}
                                        </Typography>
                                    </Box>
                                )}
                            </Box>
                        </CardContent>
                    </Card>
                </TabPanel>

                <TabPanel value={tabValue} index={1}>
                    <Card>
                        <CardContent>
                            <Typography variant="h5" gutterBottom>
                                Burn wETHbT on BSC → Unlock ETH on Sepolia
                            </Typography>
                            <Alert severity="info" sx={{ mt: 2, mb: 3 }}>
                                Make sure you're connected to BSC Testnet. This will burn ALL your tokens.
                            </Alert>

                            <Box component="form" sx={{ mt: 3 }}>
                                <TextField
                                    fullWidth
                                    label="Your Token Balance"
                                    value={tokenBalance}
                                    margin="normal"
                                    disabled
                                    helperText="Available balance in wETHbT"
                                />

                                <TextField
                                    fullWidth
                                    label="Amount to Burn (wETHbT)"
                                    type="number"
                                    value={burnAmount}
                                    onChange={(e) => setBurnAmount(e.target.value)}
                                    margin="normal"
                                    disabled={loading}
                                    inputProps={{ step: "0.001", min: "0", max: tokenBalance }}
                                    helperText="Enter amount to burn"
                                />

                                <TextField
                                    fullWidth
                                    label="Sepolia Recipient Address"
                                    value={burnRecipient}
                                    onChange={(e) => setBurnRecipient(e.target.value)}
                                    margin="normal"
                                    disabled={loading}
                                    placeholder="0x..."
                                    helperText="Address that will receive ETH on Sepolia"
                                />

                                <Button
                                    fullWidth
                                    variant="contained"
                                    onClick={handleBurnTokens}
                                    disabled={loading || !isConnected || chainId !== '97'}
                                    sx={{ mt: 2 }}
                                    size="large"
                                >
                                    {loading ? <CircularProgress size={24} /> : 'Burn Tokens'}
                                </Button>

                                {burnStatus && (
                                    <Alert severity={burnStatus.includes('❌') ? 'error' : 'success'} sx={{ mt: 2 }}>
                                        {burnStatus}
                                    </Alert>
                                )}

                                {burnId && (
                                    <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                                        <Typography variant="body2">
                                            <strong>Burn ID:</strong> {burnId}
                                        </Typography>
                                    </Box>
                                )}
                            </Box>
                        </CardContent>
                    </Card>
                </TabPanel>

                <TabPanel value={tabValue} index={2}>
                    <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Sepolia Contracts
                                    </Typography>

                                    <Typography variant="body2" sx={{ mt: 2 }}>
                                        <strong>EthLockVault:</strong><br />
                                        <code>{contracts.sepolia.vault || 'Not loaded'}</code>
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        BSC Contracts
                                    </Typography>

                                    <Typography variant="body2" sx={{ mt: 2 }}>
                                        <strong>BridgeBSC:</strong><br />
                                        <code>{contracts.bsc.bridge || 'Not loaded'}</code>
                                    </Typography>

                                    <Typography variant="body2" sx={{ mt: 2 }}>
                                        <strong>wETHbT Token:</strong><br />
                                        <code>{contracts.bsc.token || 'Not loaded'}</code>
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </TabPanel>

                <Box sx={{ mt: 4, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                        Cross-Chain Bridge v2.0 | Sepolia ↔ BSC Testnet
                    </Typography>
                </Box>
            </Box>
        </Container>
    );
}

export default App;