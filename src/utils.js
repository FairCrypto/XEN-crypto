const bn2hexStr = (bn) => '0x' + (bn?.toString(16)?.padStart(64, '0') || '0')

const bn64x64ToFloat = (precision = 10) => (bn) => {
    const hex = bn?.toString(16)?.padStart(32, '0');
    // console.log(hex)
    const int = Number('0x' + hex.slice(0, 16))
    const fracX = '0x' + hex.slice(16)
    const fracN = BigInt(fracX)
    const frac = (BigInt(precision) * fracN) / (2n ** 64n)
    // console.log(fracX, fracN, frac)
    return parseFloat(`${int}.${frac.toString(10)}`)
}

const toBigInt = (bn) => BigInt(bn2hexStr(bn))

const etherToWei = 10n ** 18n

const maxBigInt = (n1, n2) => n1 > n2 ? n1 : n2

module.exports = {
    bn2hexStr,
    bn64x64ToFloat,
    toBigInt,
    etherToWei,
    maxBigInt
}
