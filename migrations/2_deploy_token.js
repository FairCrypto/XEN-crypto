const XENCrypto = artifacts.require("XENCrypto");
const Log = artifacts.require("Log");

module.exports = async function (deployer) {
  await deployer.deploy(Log);
  await deployer.link(Log, XENCrypto);
  await deployer.deploy(XENCrypto);
};
