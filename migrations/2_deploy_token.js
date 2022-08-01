const ZeroValueToken = artifacts.require("ZeroValueToken");

module.exports = function (deployer) {
  deployer.deploy(ZeroValueToken);
};
