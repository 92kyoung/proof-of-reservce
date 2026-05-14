require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },

  networks: {
    // 로컬 Hyperledger Besu (QBFT or PoA)
    besu: {
      url:      process.env.BESU_RPC_URL || "http://127.0.0.1:8545",
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
      chainId: parseInt(process.env.BESU_CHAIN_ID || "1337"),
      gas:     "auto",
    },

    // Hardhat 내장 노드 (빠른 로컬 테스트)
    hardhat: {
      chainId: 31337,
    },
  },

  paths: {
    sources:   "./contracts",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },
};
