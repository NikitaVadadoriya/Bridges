require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL;
const BSC_TESTNET_RPC_URL = process.env.BSC_TESTNET_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        version: "0.8.20",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            },
            viaIR: true
        }
    },
    networks: {
        hardhat: {
            chainId: 31337,
            allowUnlimitedContractSize: true
        },
        localhost: {
            url: "http://127.0.0.1:8545",
            chainId: 31337
        },
        sepolia: {
            url: SEPOLIA_RPC_URL,
            accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
            chainId: 11155111,
            timeout: 120000, // 2 minutes timeout
            gas: "auto",
            gasMultiplier: 1.2
        },
        bscTestnet: {
            url: BSC_TESTNET_RPC_URL,
            accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
            chainId: 97,
            timeout: 120000, // 2 minutes timeout
            gas: "auto",
            gasMultiplier: 1.2
        }
    },
    etherscan: {
        apiKey: {
            sepolia: ETHERSCAN_API_KEY,
            bscTestnet: BSCSCAN_API_KEY
        }
    },
    gasReporter: {
        enabled: process.env.REPORT_GAS !== undefined,
        currency: "USD",
        coinmarketcap: process.env.COINMARKETCAP_API_KEY
    }
};