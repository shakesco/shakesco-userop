const { ethers } = require("ethers");
const { BigNumber } = require("@ethersproject/bignumber");

/**
 * @dev This functions returns the maxFeePerGas and maxPriorityFeePerGas
 * @dev Note that this is for networks that support EIP-1559
 * @param {*} provider Your node provider
 * @returns maxFeePerGas and maxPriorityFeePerGas
 */
module.exports.getEIP1559 = async (provider) => {
  const block = await provider.getBlock("latest");

  const maxFeePerGas = BigNumber.from(block.baseFeePerGas)
    .add((await provider.getFeeData()).maxFeePerGas)
    .toString();

  const maxPriorityFeePerGas = (
    await provider.getFeeData()
  ).maxPriorityFeePerGas.toString();

  return {
    maxFeePerGas: maxFeePerGas,
    maxPriorityFeePerGas: maxPriorityFeePerGas,
  };
};

/**
 * @dev The following function returns the gas values need by the userop
 * @dev The callGasEstimate does a crude estimation, we add 55000 because estimateGas assumes call from entrypoint
 * @dev verificationGasLimit is hardcoded 100000 if no initcode. With initcode we add create2 cost
 * @dev We hardcode preverification to 21000. Careful with this one, cannot be refunded like verificationGasLimit or callGasLimit.
 * @param {*} sender The smart account address
 * @param {*} provider Your node provider
 * @param {*} calldata The operation you want the smart account to perform. If none leave empty
 * @param {*} initCode The initcode to deploy your smart account if not already deployed
 * @returns The callGasLimit, preVerificationGas and verificationGasLimit
 */

module.exports.useropGasValues = async (
  sender,
  provider,
  calldata,
  initCode
) => {
  const callGasEstimate = await provider.estimateGas({
    from: "0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789",
    to: sender,
    data: calldata ? calldata : "0x",
  });

  const initEstimate = initCode
    ? await provider.estimateGas({
        from: "0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789",
        to: ethers.dataSlice(initCode, 0, 20),
        data: ethers.dataSlice(initCode, 20),
        gasLimit: 10e6,
      })
    : "100000";

  return {
    callGasLimit: `0x${BigNumber.from(callGasEstimate)
      .add("50000")
      .toString()}`,
    preVerificationGas: BigNumber.from(callGasEstimate).add("0x5208")._hex,
    verificationGasLimit: initCode
      ? BigNumber.from(initEstimate).add("100000")._hex
      : BigNumber.from(initEstimate)._hex,
  };
};

/**
 * @dev The following function will return the bytes that need to be signed by the owner of the smart wallet.
 * @param {*} opsender The smart account address
 * @param {*} nonce The nonce of the smart account
 * @param {*} initCode The initcode of smart account if not already deployed
 * @param {*} calldata The operation you want the smart account to perform
 * @param {*} callGasLimit The limit of gas to be used for calling the intent
 * @param {*} verificationGasLimit Gas limit of gas to be used for verifying userop
 * @param {*} preVerificationGas Gas consumed before executing transaction
 * @param {*} maxFeePerGas EIP 1559 compliant maxFeePerGas
 * @param {*} maxPriorityFeePerGas EIP 1559 compliant maxFeePerGas
 * @param {*} paymasterAndDataNOSIG The paymasterandData, NOTE: Should not be signed if verifying paymaster
 * @param {*} chainId The chainid of the network the userop is being sent to
 * @returns bytes that need to be signed to produce signature
 */
module.exports.useropHash = (
  opsender,
  nonce,
  initCode,
  calldata,
  callGasLimit,
  verificationGasLimit,
  preVerificationGas,
  maxFeePerGas,
  maxPriorityFeePerGas,
  paymasterAndDataNOSIG,
  chainId
) => {
  const getUserOpHash = () => {
    const packed = ethers.AbiCoder.defaultAbiCoder().encode(
      [
        "address",
        "uint256",
        "bytes32",
        "bytes32",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "bytes32",
      ],
      [
        opsender,
        nonce,
        ethers.keccak256(initCode),
        ethers.keccak256(calldata),
        callGasLimit,
        verificationGasLimit,
        preVerificationGas,
        maxFeePerGas,
        maxPriorityFeePerGas,
        paymasterAndDataNOSIG != "0x"
          ? ethers.keccak256("0x")
          : ethers.keccak256(paymasterAndDataNOSIG),
      ]
    );

    const enc = ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "address", "uint256"],
      [
        ethers.keccak256(packed),
        "0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789",
        chainId.toString(),
      ]
    );

    return ethers.keccak256(enc);
  };

  return ethers.getBytes(getUserOpHash());
};
