const XENCrypto = artifacts.require("XENCrypto");
const Math = artifacts.require("Math");

module.exports = async function (deployer) {
  // await deployer.deploy(Math);
  const math = Math.at('0x2AB0e9e4eE70FFf1fB9D67031E44F6410170d00e')
  await deployer.link(math, XENCrypto);
  await deployer.deploy(XENCrypto);
};
