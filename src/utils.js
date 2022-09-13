const bn2hexStr = (bn) => '0x' + (bn?.toString(16)?.padStart(64, '0') || '0')
const toBigInt = (bn) => BigInt(bn2hexStr(bn))
const etherToWei = 10n ** 18n

const maxBigInt = (n1, n2) => n1 > n2 ? n1 : n2

module.exports = {
    bn2hexStr,
    toBigInt,
    etherToWei,
    maxBigInt
}
