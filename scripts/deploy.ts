import hre from "hardhat";
import dotenv from "dotenv";
import * as assert from "assert";

dotenv.config();

async function main() {

  const network = hre.network.name;
  console.log(`Deploying to ${network}`);

  let xenCryptoAddress = process.env[`${network.toUpperCase()}_CONTRACT_ADDRESS`];
  if (network === 'hardhat' || !xenCryptoAddress) {
    // deploy XenCrypto first

    const XenMath = await hre.viem.deployContract("XENMath");
    const XenCrypto = await hre.ethers.getContractFactory(
      "XENCrypto",
      {
        libraries: {
          XENMath: XenMath.address
        }
      });
    const xenCrypto = await XenCrypto.deploy();
    xenCryptoAddress = await xenCrypto.getAddress();
    console.log(`XenCrypto deployed to ${xenCryptoAddress}`);
  } else {
    console.log(`Using existing XenCrypto contract at ${xenCryptoAddress}`);
  }
  assert.ok(xenCryptoAddress, `No contract address found for ${network}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
