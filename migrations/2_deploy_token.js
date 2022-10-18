const XENCrypto = artifacts.require("XENCrypto");
const Math = artifacts.require("Math");

module.exports = async function (deployer) {
  // await deployer.deploy(Math);
  const math = await Math.deployed();
  await deployer.link(math, XENCrypto);
  await deployer.deploy(XENCrypto);
};
