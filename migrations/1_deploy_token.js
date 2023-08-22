const XENCrypto = artifacts.require("XENCrypto");
const XENMath = artifacts.require("XENMath");

module.exports = async function (deployer) {
  await deployer.deploy(XENMath);
  await deployer.link(XENMath, XENCrypto);
  await deployer.deploy(XENCrypto);
};
