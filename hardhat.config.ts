import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import "@nomicfoundation/hardhat-ethers";

import dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 20000
      },
      evmVersion: "shanghai"
    }
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    sepolia: {
      url: "https://sepolia.infura.io/v3/c49e0aea3e654d2a8d02ce82db123438",
      accounts: [ process.env.LIVE_PK || "" ]
    }
  },
};

export default config;
