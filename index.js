import { lzAdapterParamsToBytes,
    feeBridgeBTC,
    dataBridgeBTCAvaxToArbitrum,
    dataBridgeBTCArbitrumToAvax,
    feeBridgeStargate,
    dataStargateBridgeAvaxToOther,
    dataStargateBridgeOtherToAvax,
    feeBridgeAptos,
    dataBridgeUSDCAvaxToAptos,
    claimUSDCAptos, 
    bridgeUSDCAptosToAvax } from 'tools-d4rk444/bridge.js';
import { dataSwapAvaxToToken, dataSwapTokenToAvax, dataSwapTokenToToken } from 'tools-d4rk444/DEX.js';
import { timeout, generateRandomAmount, rpc, chainContract, parseFile, shuffle } from 'tools-d4rk444/other.js';
import { privateToAddress,
    privateToAptosAddress,
    checkAllowance,
    getETHAmount,
    getAmountToken,
    sendEVMTX,
    dataApprove,
    getBalanceAptos,
    getBalanceUSDCAptos, 
    dataSendToken,
    getGasPrice } from 'tools-d4rk444/web3.js';
import { add, subtract, multiply, divide } from 'mathjs';
import readline from 'readline-sync';
import consoleStamp from 'console-stamp';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
dotenv.config();

consoleStamp(console, { format: ':date(HH:MM:ss)' });

const walletAvalanche = [
    '0x60365500fc2b09d8ab6AFf7dd444d0dA0Fe8059C',
    '0xf8d266188f62bdb55d73a5980a19a8a72a8251f2',
    '0x3858e98a0a9b5b5753b9187034732e4e5e812017',
    '0xfdc79905818aa8e0ff637c2627c98b1e8b5a54b5'
]

const walletArbitrumBTC = [
    '0x16d436e9c5e21d29188f3036e71d915043ac041c',
    '0xf8d266188f62bdb55d73a5980a19a8a72a8251f2',
    '0x3858e98a0a9b5b5753b9187034732e4e5e812017',
    '0xfdc79905818aa8e0ff637c2627c98b1e8b5a54b5'
]

const walletPolygonUSDC = [
    '0xA8b3b288Aaf139BD87169b2E3e1212Ceb6cb4b96',
    '0x21cb017b40abe17b6dfb9ba64a3ab0f24a7e60ea',
    '0x293ed38530005620e4b28600f196a97e1125daac',
    '0x51bfacfce67821ec05d3c9bc9a8bc8300fb29564',
]

const walletBSCUSDC = [
    '0xA8b3b288Aaf139BD87169b2E3e1212Ceb6cb4b96',
    '0x393A06301E1c3eD34c0497e9c46bF251A2794B79',
    '0xf54eEb92AB2d295039E3970c5a0365E46a9dBeec',
    '0x749a39B0679575CcF2ED50818C04bE270E8Bd300',
]

const getTrueWallet = async(rpc, tokenAddress, amountETH, amountToken, walletArr) => {
    let status;
    let wallet;
    let i = 0;
    while(!status) {
        await getETHAmount(rpc, walletArr[i]).then(async(res) => {
            if (res >= amountETH) {
                await getAmountToken(rpc, tokenAddress, walletArr[i]).then((res1) => {
                    if (res1 >= amountToken) {
                        status = true;
                        wallet = walletArr[i];
                    }
                });
            }
            i++
        });
        if (wallet) {
            return wallet
        } else if (i == walletArr.length) {
            throw new Error('No suitable address');
        }
    }
}

const getFeeBridgeBTC = async(amount, address) => {
    let feeArbitrumBridge;
    let valueArbitrumTx;
    let feeAvalancheBTCBridge;
    let feeAvalancheOther;
    //CALCULATE AVAX FOR BTC BRIDGE [AVAX-ARBITRUM]

    //FEE BRIDGE 20%
    await feeBridgeBTC(rpc.Arbitrum, chainContract.Avalanche.leyer0ChainId, chainContract.Arbitrum.BTCbRouter, 2, 300000, 0, address).then(async(res) => {
        feeArbitrumBridge = parseInt(multiply(Number(res), 1.2));
    });

    //BRIDGE 15%
    let wallet = await getTrueWallet(rpc.Arbitrum, chainContract.Arbitrum.BTCB, feeArbitrumBridge, amount, walletArbitrumBTC);
    const lzParams = await lzAdapterParamsToBytes(2, 300000, 0, wallet);
    await dataBridgeBTCArbitrumToAvax(rpc.Arbitrum, amount, lzParams, feeArbitrumBridge, wallet).then(async(res1) => {
        const feeArbitrumTx = parseInt((res1.estimateGas * 1.15) * 0.1 * 10**9);
        valueArbitrumTx = add(feeArbitrumBridge, feeArbitrumTx);
    });

    //FEE BRIDGE 5%
    await feeBridgeBTC(rpc.Avalanche,
        chainContract.Arbitrum.leyer0ChainId,
        chainContract.Avalanche.BTCbRouter,
        2,
        3000000,
        valueArbitrumTx,
        wallet).then(async (res1) => {
            feeAvalancheBTCBridge = parseInt(multiply(Number(res1), 1.05));
        });

    //SWAP
    await dataSwapAvaxToToken(rpc.Avalanche,
        amount * 10**10,
        chainContract.Avalanche.WAVAX,
        chainContract.Avalanche.USDC,
        chainContract.Avalanche.TraderJoe,
        address).then((res1) => {
            feeAvalancheOther = Number(res1.estimateGas) * 31.5 * 10**9;
        });

    //APPROVE
    await dataApprove(rpc.Avalanche, chainContract.Avalanche.USDC, chainContract.Avalanche.TraderJoe, address).then((res) => {
        feeAvalancheOther = add(feeAvalancheOther, Number(res.estimateGas) * 31.5 * 10**9);
    });

    //SWAP
    wallet = await getTrueWallet(rpc.Avalanche, chainContract.Avalanche.USDC, 0, amount, walletAvalanche);
    await dataSwapTokenToAvax(rpc.Avalanche,
        amount,
        chainContract.Avalanche.USDC,
        chainContract.Avalanche.WAVAX,
        chainContract.Avalanche.TraderJoe,
        wallet).then((res) => {
            feeAvalancheOther = add(feeAvalancheOther, Number(res.estimateGas) * 31.5 * 10**9);
        });

    //BRIDGE
    wallet = await getTrueWallet(rpc.Avalanche, chainContract.Avalanche.BTCB, feeAvalancheBTCBridge, amount, walletAvalanche);
    await dataBridgeBTCAvaxToArbitrum(rpc.Avalanche,
        amount,
        await lzAdapterParamsToBytes(2, 3000000, valueArbitrumTx, address),
        feeAvalancheBTCBridge,
        wallet).then((res1) => {
            feeAvalancheOther = add(feeAvalancheOther, Number(res1.estimateGas) * 31.5 * 10**9);
        });

    return { feeArbitrumBridge, valueArbitrumTx, feeAvalancheBTCBridge, feeAvalancheOther };
}

const getFeeBridgeUSDCPOLY = async(amount, address) => {
    let feePolygonBridge;
    let feePolygonTx;
    let valuePolygonTx;
    let feeAvalancheUSDCBridge;
    let feeAvalancheOther;
    //CALCULATE AVAX FOR USDC BRIDGE [AVAX-POLYGON]

    //FEE BRIDGE 5%
    await feeBridgeStargate(rpc.Polygon, chainContract.Avalanche.leyer0ChainId, chainContract.Polygon.StargateRouter, 605000, 0, address).then(async(res) => {
        feePolygonBridge = parseInt(multiply(Number(res), 1.05));
    });

    //APPROVE
    await dataApprove(rpc.Polygon, chainContract.Polygon.USDC, chainContract.Polygon.StargateRouter, address).then((res) => {
        feePolygonTx = parseInt(res.estimateGas * 340 * 10**9);
    });

    //BRIDGE
    let wallet = await getTrueWallet(rpc.Polygon, chainContract.Polygon.USDC, feePolygonBridge, amount, walletPolygonUSDC);
    await dataStargateBridgeOtherToAvax(rpc.Polygon,
        chainContract.Polygon.USDCID,
        chainContract.Avalanche.USDCID,
        amount,
        605000,
        0,
        feePolygonBridge,
        chainContract.Polygon.StargateRouter,
        wallet).then(async(res) => {
            feePolygonTx = parseInt(add(feePolygonTx, res.estimateGas * 340 * 10**9));
            valuePolygonTx = add(feePolygonBridge, feePolygonTx);
        });

    //FEE BRIDGE 5%
    await feeBridgeStargate(rpc.Avalanche,
        chainContract.Polygon.leyer0ChainId,
        chainContract.Avalanche.StargateRouter,
        305000,
        valuePolygonTx,
        address).then(async(res) => {
            feeAvalancheUSDCBridge = parseInt(multiply(Number(res), 1.05));
        });

    //SWAP
    await dataSwapAvaxToToken(rpc.Avalanche,
        amount * 10**12,
        chainContract.Avalanche.WAVAX,
        chainContract.Avalanche.USDC,
        chainContract.Avalanche.TraderJoe,
        address).then((res) => {
            feeAvalancheOther = Number(res.estimateGas) * 31.5 * 10**9;
        });

    //APPROVE
    await dataApprove(rpc.Avalanche, chainContract.Avalanche.USDC, chainContract.Avalanche.TraderJoe, address).then((res) => {
        feeAvalancheOther = add(feeAvalancheOther, Number(res.estimateGas) * 31.5 * 10**9);
    });

    //SWAP
    wallet = await getTrueWallet(rpc.Avalanche, chainContract.Avalanche.USDC, feeAvalancheUSDCBridge, amount, walletAvalanche);
    await dataSwapTokenToAvax(rpc.Avalanche,
        amount,
        chainContract.Avalanche.USDC,
        chainContract.Avalanche.WAVAX,
        chainContract.Avalanche.TraderJoe,
        wallet).then((res) => {
            feeAvalancheOther = add(feeAvalancheOther, Number(res.estimateGas) * 31.5 * 10**9);
        });

    //BRIDGE
    await dataStargateBridgeAvaxToOther(rpc.Avalanche,
        chainContract.Polygon.leyer0ChainId,
        chainContract.Avalanche.USDCID,
        chainContract.Polygon.USDCID,
        amount,
        305000,
        valuePolygonTx,
        feeAvalancheUSDCBridge,
        chainContract.Avalanche.StargateRouter,
        wallet).then((res) => {
            feeAvalancheOther = add(feeAvalancheOther, Number(res.estimateGas) * 31.5 * 10**9);
        });

    return { feePolygonBridge, valuePolygonTx, feeAvalancheUSDCBridge, feeAvalancheOther };
}

const getFeeBridgeUSDCBSC = async(amount, address) => {
    let feeBSCBridge;
    let valueBSCTx;
    let feeAvalancheUSDCBridge;
    let feeAvalancheOther;
    let feeBSCTx;
    //CALCULATE AVAX FOR USDC BRIDGE [AVAX-BSC]
    //FEE BRIDGE 2%
    await feeBridgeStargate(rpc.BSC, chainContract.BSC.leyer0ChainId, chainContract.BSC.StargateRouter, 205000, 0, address).then(async(res) => {
        feeBSCBridge = parseInt(multiply(Number(res), 1.02));
    });

    //APPROVE
    await dataApprove(rpc.BSC, chainContract.BSC.USDT, chainContract.BSC.StargateRouter, address).then((res) => {
        feeBSCTx = parseInt(res.estimateGas * 6 * 10**9);
    });

    //BRIDGE
    let wallet = await getTrueWallet(rpc.BSC, chainContract.BSC.USDC, feeBSCBridge, amount, walletBSCUSDC);
    await dataStargateBridgeOtherToAvax(rpc.BSC,
        chainContract.BSC.USDTID,
        chainContract.Avalanche.USDCID,
        amount,
        205000,
        0,
        feeBSCBridge,
        chainContract.BSC.StargateRouter,
        wallet).then(async(res1) => {
            feeBSCTx = add(feeBSCTx, parseInt((res1.estimateGas * 1.1) * 6 * 10**9));
            valueBSCTx = add(feeBSCBridge, feeBSCTx, 0.01 * 10**18);
        });

    //FEE BRIDGE 5%
    await feeBridgeStargate(rpc.Avalanche,
        chainContract.BSC.leyer0ChainId,
        chainContract.Avalanche.StargateRouter,
        205000,
        valueBSCTx,
        address).then(async(res2) => {
            feeAvalancheUSDCBridge = parseInt(multiply(Number(res2), 1.05));
        });

    //SWAP 10%
    await dataSwapAvaxToToken(rpc.Avalanche,
        amount * 10**10,
        chainContract.Avalanche.WAVAX,
        chainContract.Avalanche.USDC,
        chainContract.Avalanche.TraderJoe,
        address).then((res) => {
            feeAvalancheOther = multiply(Number(res.estimateGas), 1.1) * 31.5 * 10**9;
        });

    //APPROVE
    await dataApprove(rpc.Avalanche, chainContract.Avalanche.USDC, chainContract.Avalanche.TraderJoe, address).then((res) => {
        feeAvalancheOther = add(feeAvalancheOther, Number(res.estimateGas) * 31.5 * 10**9);
    });

    //SWAP
    wallet = await getTrueWallet(rpc.Avalanche, chainContract.Avalanche.USDC, feeAvalancheUSDCBridge, amount, walletAvalanche);
    await dataSwapTokenToAvax(rpc.Avalanche,
        amount,
        chainContract.Avalanche.USDC,
        chainContract.Avalanche.WAVAX,
        chainContract.Avalanche.TraderJoe,
        wallet).then((res) => {
            feeAvalancheOther = add(feeAvalancheOther, Number(res.estimateGas) * 31.5 * 10**9);
        });

    //BRIDGE
    await dataStargateBridgeAvaxToOther(rpc.Avalanche,
        chainContract.Polygon.leyer0ChainId,
        chainContract.Avalanche.USDCID,
        chainContract.Polygon.USDCID,
        amount,
        205000,
        valueBSCTx,
        feeAvalancheUSDCBridge,
        chainContract.Avalanche.StargateRouter,
        wallet).then((res1) => {
            feeAvalancheOther = add(feeAvalancheOther, Number(res1.estimateGas) * 31.5 * 10**9);
        });

    return { feeBSCBridge, valueBSCTx, feeAvalancheUSDCBridge, feeAvalancheOther };
}

const getFeeBridgeAPTOS = async(amount, address) => {
    let feeAvalancheAPTOSBridge;
    let feeAvalancheOther;
    let valueAPTTx = 4000000;
    //CALCULATE AVAX FOR BTC BRIDGE [AVAX-APTOS]
    await feeBridgeAptos(rpc.Avalanche, chainContract.Avalanche.AptosRouter, 2, 50000, valueAPTTx, address).then(async(res) => {
        //PLUS 10% ETH
        feeAvalancheAPTOSBridge = parseInt(multiply(Number(res), 1.1));
        //PLUS 75% ETH
        await dataSwapAvaxToToken(rpc.Avalanche,
            amount * 10**10,
            chainContract.Avalanche.WAVAX,
            chainContract.Avalanche.USDC,
            chainContract.Avalanche.TraderJoe,
            address).then((res1) => {
                feeAvalancheOther = multiply(Number(res1.estimateGas), 1.75) * 31.5 * 10**9;
            });
    });

    return { valueAPTTx, feeAvalancheAPTOSBridge, feeAvalancheOther };
}

//------------------------------------------------------------------------

const stageBTCBridge = async(feeArbitrumBridge, valueArbitrumTx, feeAvalancheBTCBridge, feeAvalancheOther, pauseTime, privateKey) => {
    console.log(chalk.bgMagentaBright('Bridge BTCb Avalanche -> Arbitrum -> Avalanche'));
    const address = privateToAddress(privateKey);
    let status;

    //EXCHANGE AVAX TO BTCB
    console.log(chalk.cyan('Start exchange AVAX to BTCb'));
    await getETHAmount(rpc.Avalanche, address).then(async(res) => {
        const amount = parseInt(subtract(res, add(feeAvalancheBTCBridge, feeAvalancheOther))).toString();
        if (amount <= 0) {
            throw new Error(`ERROR: ${address} NOT enough Avax to swap`);
        } else if (amount > 0) {
            //SWAP WAVAX TO BTCB
            await dataSwapAvaxToToken(rpc.Avalanche,
                amount,
                chainContract.Avalanche.WAVAX,
                chainContract.Avalanche.BTCB,
                chainContract.Avalanche.TraderJoe,
                address).then(async(res1) => {
                    await sendEVMTX(rpc.Avalanche,
                        2,
                        res1.estimateGas,
                        '0',
                        '30',
                        '1.5',
                        chainContract.Avalanche.TraderJoe,
                        amount,
                        res1.encodeABI,
                        privateKey);
                });
        }
    });
    await timeout(pauseTime);

    //BRIDGE BTCB TO ARBITRUM
    console.log(chalk.cyan('Start bridge BTCb to Arbitrum'));
    await getAmountToken(rpc.Avalanche, chainContract.Avalanche.BTCB, address).then(async(res) => {
        if (res == 0) {
            throw new Error(`ERROR: ${address} HAVE 0 BTCB`);
        } else if (res > 0) {
            //CHECK ALLOWANCE
            await checkAllowance(rpc.Avalanche, chainContract.Avalanche.BTCB, address, chainContract.Avalanche.BTCbRouter).then(async(res1) => {
                if (res1 < chainContract.approveAmount) {
                    console.log('Approve');
                    await dataApprove(rpc.Avalanche, chainContract.Avalanche.BTCB, chainContract.Avalanche.BTCbRouter, address).then(async(res2) => {
                        await sendEVMTX(rpc.Avalanche,
                            2,
                            res2.estimateGas,
                            '0',
                            '30',
                            '1.5',
                            chainContract.Avalanche.BTCB,
                            null,
                            res2.encodeABI,
                            privateKey);
                    });
                }
            });
            await timeout(pauseTime);

            //BRIDGE BTC TO ARBITRUM
            console.log('Bridge');
            await dataBridgeBTCAvaxToArbitrum(rpc.Avalanche,
                res,
                await lzAdapterParamsToBytes(2, 3000000, valueArbitrumTx, address),
                feeAvalancheBTCBridge,
                address).then(async(res1) => {
                    await sendEVMTX(rpc.Avalanche,
                        2,
                        res1.estimateGas,
                        '0',
                        '30',
                        '1.5',
                        chainContract.Avalanche.BTCbRouter,
                        feeAvalancheBTCBridge,
                        res1.encodeABI,
                        privateKey);
                });
        }
    });
    await timeout(pauseTime);

    //BRIDGE BTCB TO AVALANCHE
    console.log(chalk.cyan('Start bridge BTCb to Avalanche'));
    while (!status) {
        await getAmountToken(rpc.Arbitrum, chainContract.Arbitrum.BTCB, address).then(async(res) => {
            if (res > 0) {
                await dataBridgeBTCArbitrumToAvax(rpc.Arbitrum,
                    res,
                    await lzAdapterParamsToBytes(2, 300000, 0, address),
                    feeArbitrumBridge,
                    address).then(async(res1) => {
                        await sendEVMTX(rpc.Arbitrum,
                            2,
                            res1.estimateGas,
                            '0',
                            '0.1',
                            '0.1',
                            chainContract.Arbitrum.BTCbRouter,
                            feeArbitrumBridge,
                            res1.encodeABI,
                            privateKey);
                    });
                status = true;
            } else if (res == 0) {
                console.log(chalk.yellow('Wait BTCb on Arbitrum... [~ 2min : Update every 1min]'));
                await timeout(60000);
            }
        });
    }
    await timeout(pauseTime);

    //SWAP BTCB TO AVAX
    console.log(chalk.cyan('Start swap BTCb to AVAX'));
    status = false;
    while(!status) {
        await getAmountToken(rpc.Avalanche, chainContract.Avalanche.BTCB, address).then(async(res) => {
            if (res > 0) {
                //CHECK ALLOWANCE
                await checkAllowance(rpc.Avalanche, chainContract.Avalanche.BTCB, address, chainContract.Avalanche.TraderJoe).then(async(res1) => {
                    if (res1 < chainContract.approveAmount) {
                        console.log('Approve');
                        await dataApprove(rpc.Avalanche, chainContract.Avalanche.BTCB, chainContract.Avalanche.TraderJoe, address).then(async(res1) => {
                            await sendEVMTX(rpc.Avalanche,
                                2,
                                res1.estimateGas,
                                '0',
                                '30',
                                '1.5',
                                chainContract.Avalanche.BTCB,
                                null,
                                res1.encodeABI,
                                privateKey);
                        });
                        await timeout(pauseTime);
                    }
                });

                //SWAP BTCB TO USDC
                console.log('Swap');
                await dataSwapTokenToAvax(rpc.Avalanche,
                    res,
                    chainContract.Avalanche.BTCB,
                    chainContract.Avalanche.WAVAX,
                    chainContract.Avalanche.TraderJoe,
                    address).then(async(res1) => {
                        await sendEVMTX(rpc.Avalanche,
                            2,
                            res1.estimateGas,
                            '0',
                            '30',
                            '1.5',
                            chainContract.Avalanche.TraderJoe,
                            null,
                            res1.encodeABI,
                            privateKey);
                    });
                status = true;
            } else if (res == 0) {
                console.log(chalk.yellow('Wait BTCb on Avalanche... [~ 2min : Update every 1min]'));
                await timeout(60000);
            }
        });
    }
    await timeout(pauseTime);
}

const stageUSDCBSCBridge = async(feeBSCBridge, valueBSCTx, feeAvalancheUSDCBridge, feeAvalancheOther, pauseTime, privateKey) => {
    console.log(chalk.bgMagentaBright('Bridge USDC Avalanche -> BSC -> Avalanche'));
    const address = privateToAddress(privateKey);
    let status;

    //EXCHANGE AVAX TO USDC
    console.log(chalk.cyan('Start exchange AVAX to USDC'));
    await getETHAmount(rpc.Avalanche, address).then(async(res) => {
        const amount = parseInt(subtract(res, add(feeAvalancheUSDCBridge, feeAvalancheOther))).toString();
        if (amount <= 0) {
            throw new Error(`ERROR: ${address} NOT enough Avax to swap`);
        } else if (amount > 0) {
            //SWAP WAVAX TO USDC
            await dataSwapAvaxToToken(rpc.Avalanche,
                amount,
                chainContract.Avalanche.WAVAX,
                chainContract.Avalanche.USDC,
                chainContract.Avalanche.TraderJoe,
                address).then(async(res1) => {
                    await sendEVMTX(rpc.Avalanche,
                        2,
                        res1.estimateGas,
                        '0',
                        '30',
                        '1.5',
                        chainContract.Avalanche.TraderJoe,
                        amount,
                        res1.encodeABI,
                        privateKey);
                });
        }
    });
    await timeout(pauseTime);

    //BRIDGE USDC TO Polygon
    console.log(chalk.cyan('Start bridge USDC to BSC'));
    await getAmountToken(rpc.Avalanche, chainContract.Avalanche.USDC, address).then(async(res) => {
        if (res == 0) {
            throw new Error(`ERROR: ${address} HAVE 0 USDC`);
        } else if (res > 0) {
            //CHECK ALLOWANCE
            await checkAllowance(rpc.Avalanche, chainContract.Avalanche.USDC, address, chainContract.Avalanche.StargateRouter).then(async(res1) => {
                if (res1 < chainContract.approveAmount) {
                    console.log('Approve');
                    await dataApprove(rpc.Avalanche, chainContract.Avalanche.USDC, chainContract.Avalanche.StargateRouter, address).then(async(res2) => {
                        await sendEVMTX(rpc.Avalanche,
                            2,
                            res2.estimateGas,
                            '0',
                            '30',
                            '1.5',
                            chainContract.Avalanche.USDC,
                            null,
                            res2.encodeABI,
                            privateKey);
                    });
                    await timeout(pauseTime);
                }
            });

            //BRIDGE USDC TO BSC
            console.log('Bridge');
            await dataStargateBridgeAvaxToOther(rpc.Avalanche,
                chainContract.BSC.leyer0ChainId,
                chainContract.Avalanche.USDCID,
                chainContract.BSC.USDTID,
                res,
                205000,
                valueBSCTx,
                feeAvalancheUSDCBridge,
                chainContract.Avalanche.StargateRouter,
                address).then(async(res1) => {
                    await sendEVMTX(rpc.Avalanche,
                        2,
                        res1.estimateGas,
                        '0',
                        '30',
                        '1.5',
                        chainContract.Avalanche.StargateRouter,
                        feeAvalancheUSDCBridge,
                        res1.encodeABI,
                        privateKey);
                });
        }
    });
    await timeout(pauseTime);

    //BRIDGE USDC TO Avalanche
    console.log(chalk.cyan('Start bridge USDC to Avalanche'));
    while (!status) {
        await getAmountToken(rpc.BSC, chainContract.BSC.USDT, address).then(async(res) => {
            if (res > 0) {
                //CHECK ALLOWANCE
                await checkAllowance(rpc.BSC, chainContract.BSC.USDT, address, chainContract.BSC.StargateRouter).then(async(res1) => {
                    if (res1 < chainContract.approveAmount) {
                        console.log('Approve');
                        await dataApprove(rpc.BSC, chainContract.BSC.USDT, chainContract.BSC.StargateRouter, address).then(async(res2) => {
                            await sendEVMTX(rpc.BSC,
                                0,
                                res2.estimateGas,
                                '6',
                                '0',
                                '0',
                                chainContract.BSC.USDT,
                                null,
                                res2.encodeABI,
                                privateKey);
                        });
                        await timeout(pauseTime);
                    }
                });

                //BRIDGE USDC TO AVALANCHE
                console.log('Bridge');
                await dataStargateBridgeOtherToAvax(rpc.BSC,
                    chainContract.BSC.USDTID,
                    chainContract.Avalanche.USDCID,
                    res,
                    205000,
                    0,
                    feeBSCBridge,
                    chainContract.BSC.StargateRouter,
                    address).then(async(res1) => {
                        await sendEVMTX(rpc.BSC,
                            0,
                            res1.estimateGas,
                            '6',
                            '0',
                            '0',
                            chainContract.BSC.StargateRouter,
                            feeBSCBridge,
                            res1.encodeABI,
                            privateKey);
                    });
                status = true;
            } else if (res == 0) {
                console.log(chalk.yellow('Wait USDT on BSC... [~ 2min : Update every 1min]'));
                await timeout(60000);
            }
        });
    }
    await timeout(pauseTime);

    //SWAP USDC TO AVAX
    console.log(chalk.cyan('Start swap USDC to AVAX'));
    status = false;
    while(!status) {
        await getAmountToken(rpc.Avalanche, chainContract.Avalanche.USDC, address).then(async(res) => {
            if (res > 0) {
                //CHECK ALLOWANCE
                await checkAllowance(rpc.Avalanche, chainContract.Avalanche.USDC, address, chainContract.Avalanche.TraderJoe).then(async(res1) => {
                    if (res1 < chainContract.approveAmount) {
                        console.log('Approve');
                        await dataApprove(rpc.Avalanche, chainContract.Avalanche.USDC, chainContract.Avalanche.TraderJoe, address).then(async(res1) => {
                            await sendEVMTX(rpc.Avalanche,
                                2,
                                res1.estimateGas,
                                '0',
                                '30',
                                '1.5',
                                chainContract.Avalanche.USDC,
                                null,
                                res1.encodeABI,
                                privateKey);
                        });
                        await timeout(pauseTime);
                    }
                });

                //SWAP USDC TO USDC
                console.log('Swap');
                await dataSwapTokenToAvax(rpc.Avalanche,
                    res,
                    chainContract.Avalanche.USDC,
                    chainContract.Avalanche.WAVAX,
                    chainContract.Avalanche.TraderJoe,
                    address).then(async(res1) => {
                        await sendEVMTX(rpc.Avalanche,
                            2,
                            res1.estimateGas,
                            '0',
                            '30',
                            '1.5',
                            chainContract.Avalanche.TraderJoe,
                            null,
                            res1.encodeABI,
                            privateKey);
                    });
                status = true;
            } else if (res == 0) {
                console.log(chalk.yellow('Wait USDC on Avalanche... [~ 2min : Update every 1min]'));
                await timeout(60000);
            }
        });
    }
    await timeout(pauseTime);
}

const stageUSDCPOLYBridge = async(feePolygonBridge, valuePolygonTx, feeAvalancheUSDCBridge, feeAvalancheOther, pauseTime, privateKey) => {
    console.log(chalk.bgMagentaBright('Bridge USDC Avalanche -> Polygon -> Avalanche'));
    const address = privateToAddress(privateKey);
    let status;

    //EXCHANGE AVAX TO USDC
    console.log(chalk.cyan('Start exchange AVAX to USDC'));
    await getETHAmount(rpc.Avalanche, address).then(async(res) => {
        const amount = parseInt(subtract(res, add(feeAvalancheUSDCBridge, feeAvalancheOther))).toString();
        if (amount <= 0) {
            throw new Error(`ERROR: ${address} NOT enough Avax to swap`);
        } else if (amount > 0) {
            //SWAP WAVAX TO USDC
            await dataSwapAvaxToToken(rpc.Avalanche,
                amount,
                chainContract.Avalanche.WAVAX,
                chainContract.Avalanche.USDC,
                chainContract.Avalanche.TraderJoe,
                address).then(async(res1) => {
                    await sendEVMTX(rpc.Avalanche,
                        2,
                        res1.estimateGas,
                        '0',
                        '30',
                        '1.5',
                        chainContract.Avalanche.TraderJoe,
                        amount,
                        res1.encodeABI,
                        privateKey);
                });
        }
    });
    await timeout(pauseTime);

    //BRIDGE USDC TO Polygon
    console.log(chalk.cyan('Start bridge USDC to Polygon'));
    await getAmountToken(rpc.Avalanche, chainContract.Avalanche.USDC, address).then(async(res) => {
        if (res == 0) {
            throw new Error(`ERROR: ${address} HAVE 0 USDC`);
        } else if (res > 0) {
            //CHECK ALLOWANCE
            await checkAllowance(rpc.Avalanche, chainContract.Avalanche.USDC, address, chainContract.Avalanche.StargateRouter).then(async(res1) => {
                if (res1 < chainContract.approveAmount) {
                    console.log('Approve');
                    await dataApprove(rpc.Avalanche, chainContract.Avalanche.USDC, chainContract.Avalanche.StargateRouter, address).then(async(res2) => {
                        await sendEVMTX(rpc.Avalanche,
                            2,
                            res2.estimateGas,
                            '0',
                            '30',
                            '1.5',
                            chainContract.Avalanche.USDC,
                            null,
                            res2.encodeABI,
                            privateKey);
                    });
                    await timeout(pauseTime);
                }
            });

            //BRIDGE USDC TO POLYGON
            console.log('Bridge');
            await dataStargateBridgeAvaxToOther(rpc.Avalanche,
                chainContract.Polygon.leyer0ChainId,
                chainContract.Avalanche.USDCID,
                chainContract.Polygon.USDCID,
                res,
                305000,
                valuePolygonTx,
                feeAvalancheUSDCBridge,
                chainContract.Avalanche.StargateRouter,
                address).then(async(res1) => {
                    await sendEVMTX(rpc.Avalanche,
                        2,
                        res1.estimateGas,
                        '0',
                        '30',
                        '1.5',
                        chainContract.Avalanche.StargateRouter,
                        feeAvalancheUSDCBridge,
                        res1.encodeABI,
                        privateKey);
                });
        }
    });
    await timeout(pauseTime);

    //BRIDGE USDC TO AVALANCHE
    console.log(chalk.cyan('Start bridge USDC to Avalanche'));
    while (!status) {
        await getAmountToken(rpc.Polygon, chainContract.Polygon.USDC, address).then(async(res) => {
            if (res > 0) {
                //CHECK ALLOWANCE
                await checkAllowance(rpc.Polygon, chainContract.Polygon.USDC, address, chainContract.Polygon.StargateRouter).then(async(res1) => {
                    if (res1 < chainContract.approveAmount) {
                        console.log('Approve');
                        await dataApprove(rpc.Polygon, chainContract.Polygon.USDC, chainContract.Polygon.StargateRouter, address).then(async(res2) => {
                            await sendEVMTX(rpc.Polygon,
                                2,
                                res2.estimateGas,
                                '0',
                                '350',
                                '40',
                                chainContract.Polygon.USDC,
                                null,
                                res2.encodeABI,
                                privateKey);
                        });
                        await timeout(pauseTime);
                    }
                });

                console.log('Bridge');
                await dataStargateBridgeOtherToAvax(rpc.Polygon,
                    chainContract.Polygon.USDCID,
                    chainContract.Avalanche.USDCID,
                    res,
                    605000,
                    0,
                    feePolygonBridge,
                    chainContract.Polygon.StargateRouter,
                    address).then(async(res1) => {
                        await sendEVMTX(rpc.Polygon,
                            2,
                            res1.estimateGas,
                            '0',
                            '350',
                            '40',
                            chainContract.Polygon.StargateRouter,
                            feePolygonBridge,
                            res1.encodeABI,
                            privateKey);
                    });
                status = true;
            } else if (res == 0) {
                console.log(chalk.yellow('Wait USDC on Polygon... [~ 2min : Update every 1min]'));
                await timeout(60000);
            }
        });
    }
    await timeout(pauseTime);

    //SWAP USDC TO AVAX
    /*console.log(chalk.cyan('Start swap USDC to AVAX'));
    status = false;
    while(!status) {
        await getAmountToken(rpc.Avalanche, chainContract.Avalanche.USDC, address).then(async(res) => {
            if (res > 0) {
                //CHECK ALLOWANCE
                await checkAllowance(rpc.Avalanche, chainContract.Avalanche.USDC, address, chainContract.Avalanche.TraderJoe).then(async(res1) => {
                    if (res1 < chainContract.approveAmount) {
                        console.log('Approve');
                        await dataApprove(rpc.Avalanche, chainContract.Avalanche.USDC, chainContract.Avalanche.TraderJoe, address).then(async(res1) => {
                            await sendEVMTX(rpc.Avalanche,
                                2,
                                res1.estimateGas,
                                '0',
                                '30',
                                '1.5',
                                chainContract.Avalanche.USDC,
                                null,
                                res1.encodeABI,
                                privateKey);
                        });
                        await timeout(pauseTime);
                    }
                });

                //SWAP USDC TO AVAX
                console.log('Swap');
                await dataSwapTokenToAvax(rpc.Avalanche,
                    res,
                    chainContract.Avalanche.USDC,
                    chainContract.Avalanche.WAVAX,
                    chainContract.Avalanche.TraderJoe,
                    address).then(async(res1) => {
                        await sendEVMTX(rpc.Avalanche,
                            2,
                            res1.estimateGas,
                            '0',
                            '30',
                            '1.5',
                            chainContract.Avalanche.TraderJoe,
                            null,
                            res1.encodeABI,
                            privateKey);
                    });
                status = true;
            } else if (res == 0) {
                console.log(chalk.yellow('Wait USDC on Avalanche... [~ 20min : Update every 3min]'));
                await timeout(180000);
            }
        });
    }
    await timeout(pauseTime);*/
}

const stageUSDCAPTOSBridge = async(valueAPTTx, feeAvalancheAPTOSBridge, feeAvalancheOther, pauseTime, privateKey) => {
    console.log(chalk.bgMagentaBright('Bridge USDC Avalanche -> Aptos -> Avalanche'));
    const address = privateToAddress(privateKey);
    const addressAPT = privateToAptosAddress(privateKey);
    let status;

    //EXCHANGE AVAX TO USDC
    console.log(chalk.cyan('Start exchange AVAX to USDC'));
    await getETHAmount(rpc.Avalanche, address).then(async(res) => {
        const amount = parseInt(subtract(res, add(feeAvalancheAPTOSBridge, feeAvalancheOther))).toString();
        console.log(amount / 10**18);
        if (amount <= 0) {
            throw new Error(`ERROR: ${address} NOT enough Avax to swap`);
        } else if (amount > 0) {
            //SWAP WAVAX TO USDC
            await dataSwapAvaxToToken(rpc.Avalanche,
                amount,
                chainContract.Avalanche.WAVAX,
                chainContract.Avalanche.USDC,
                chainContract.Avalanche.TraderJoe,
                address).then(async(res1) => {
                    await sendEVMTX(rpc.Avalanche,
                        2,
                        res1.estimateGas,
                        '0',
                        '30',
                        '1.5',
                        chainContract.Avalanche.TraderJoe,
                        amount,
                        res1.encodeABI,
                        privateKey);
                });
        }
    });
    await timeout(pauseTime);

    //BRIDGE USDC TO APTOS
    console.log(chalk.cyan('Start bridge USDC to APTOS'));
    await getAmountToken(rpc.Avalanche, chainContract.Avalanche.USDC, address).then(async(res) => {
        if (res == 0) {
            throw new Error(`ERROR: ${address} HAVE 0 USDC`);
        } else if (res > 0) {
            //CHECK ALLOWANCE
            await checkAllowance(rpc.Avalanche, chainContract.Avalanche.USDC, address, chainContract.Avalanche.AptosRouter).then(async(res1) => {
                if (res1 < chainContract.approveAmount) {
                    console.log('Approve');
                    await dataApprove(rpc.Avalanche, chainContract.Avalanche.USDC, chainContract.Avalanche.AptosRouter, address).then(async(res2) => {
                        await sendEVMTX(rpc.Avalanche,
                            2,
                            res2.estimateGas,
                            '0',
                            '30',
                            '1.5',
                            chainContract.Avalanche.USDC,
                            null,
                            res2.encodeABI,
                            privateKey);
                    });
                    await timeout(pauseTime);
                }
            });

            //BRIDGE USDC TO APTOS
            console.log('Bridge');
            await dataBridgeUSDCAvaxToAptos(rpc.Avalanche,
                res,
                addressAPT,
                await lzAdapterParamsToBytes(2, 50000, valueAPTTx, addressAPT),
                feeAvalancheAPTOSBridge,
                address).then(async(res1) => {
                    await sendEVMTX(rpc.Avalanche,
                        2,
                        res1.estimateGas,
                        '0',
                        '30',
                        '1.5',
                        chainContract.Avalanche.AptosRouter,
                        feeAvalancheAPTOSBridge,
                        res1.encodeABI,
                        privateKey);
                });
        }
    });
    await timeout(pauseTime);

    //CLAIM USDC FROM APTOS BRIDGE
    console.log(chalk.cyan('Start claim USDC from Aptos bridge'));
    while (!status) {
        await getBalanceAptos(privateKey).then(async(res) => {
            if (res > 8000000) {
                await claimUSDCAptos(privateKey);
                status = true;
            } else if (res <= 8000000) {
                console.log(chalk.yellow('Wait for APT... [~ 2min : Update every 1min]'));
                await timeout(60000);
            }
        });
    }
    await timeout(pauseTime);

    //BRIDGE USDC TO Avalanche
    console.log(chalk.cyan('Start bridge USDC to Avalanche'));
    status = false;
    while (!status) {
        await getBalanceUSDCAptos(privateKey).then(async(res) => {
            if (res > 0) {
                await bridgeUSDCAptosToAvax(res, address, privateKey);
                status = true;
            } else if (res == 0) {
                console.log(chalk.yellow('Wait USDC on APTOS... [~ 2min : Update every 1min]'));
                await timeout(60000);
            }
        });
    }
    await timeout(pauseTime);
}

//------------------------------------------------------------------------

const swapAllUSDCToAvax = async(pauseTime, privateKey) => {
    const address = privateToAddress(privateKey);

    //SWAP USDC TO USDC
    console.log(chalk.yellow('Swap USDC -> Avax'));
    await getAmountToken(rpc.Avalanche, chainContract.Avalanche.USDC, address).then(async(res) => {
        if (res == 0) {
            throw new Error(`ERROR: ${address} HAVE 0 USDC`);
        } else if (res > 0) {
            await checkAllowance(rpc.Avalanche, chainContract.Avalanche.USDC, address, chainContract.Avalanche.TraderJoe).then(async(res1) => {
                if (res1 < chainContract.approveAmount) {
                    console.log('Approve');
                    await dataApprove(rpc.Avalanche, chainContract.Avalanche.USDC, chainContract.Avalanche.TraderJoe, address).then(async(res1) => {
                        await sendEVMTX(rpc.Avalanche,
                            2,
                            res1.estimateGas,
                            '0',
                            '30',
                            '1.5',
                            chainContract.Avalanche.USDC,
                            null,
                            res1.encodeABI,
                            privateKey);
                    });
                    await timeout(pauseTime);
                }
            });

            console.log('Swap');
            await dataSwapTokenToAvax(rpc.Avalanche,
                res,
                chainContract.Avalanche.USDC,
                chainContract.Avalanche.WAVAX,
                chainContract.Avalanche.TraderJoe,
                address).then(async(res1) => {
                    await sendEVMTX(rpc.Avalanche,
                        2,
                        res1.estimateGas,
                        '0',
                        '30',
                        '1.5',
                        chainContract.Avalanche.TraderJoe,
                        null,
                        res1.encodeABI,
                        privateKey);
                });
        }
    });
}

const withdrawBNBToSubWallet = async(toAddress, privateKey) => {
    const address = privateToAddress(privateKey);
    await getETHAmount(rpc.BSC, address).then(async(res) => {
        let amountETH = subtract(res, 21000 * multiply(6, 10**9));
        amountETH = subtract(amountETH, generateRandomAmount(1 * 10**8, 3 * 10**10, 0));
        if (amountETH < 0.01 * 10**18) {
            console.log(chalk.red(`Can\`t send less than 0.01 BNB`));
        } else if (amountETH >= 0.01 * 10**18) {
            console.log(chalk.yellow(`Send ${amountETH / 10**18}BNB to ${toAddress} OKX`));
            await sendEVMTX(rpc.BSC, 0, 21000, '6', '0', '0', toAddress, amountETH, null, privateKey);
        }
    });
}

const withdrawAVAXToSubWallet = async(toAddress, privateKey) => {
    const address = privateToAddress(privateKey);
    await getETHAmount(rpc.Avalanche, address).then(async(res) => {
        let amountETH = subtract(res, 21000 * multiply(31.5, 10**9));
        amountETH = subtract(amountETH, generateRandomAmount(1 * 10**8, 3 * 10**10, 0));
        if (amountETH <= 0) {
            console.log(chalk.red(`${address} sent all the money`));
        } else if (amountETH > 0) {
            console.log(chalk.yellow(`Send ${amountETH / 10**18}AVAX to ${toAddress} OKX`));
            await sendEVMTX(rpc.Avalanche, 2, 21000, '0', '30', '1.5', toAddress, amountETH, null, privateKey);
        }
    });
}

const withdrawUSDCToSubWallet = async(toAddress, privateKey) => {
    const address = privateToAddress(privateKey);
    await getAmountToken(rpc.Avalanche, chainContract.Avalanche.USDC, address).then(async(res) => {
        if (res <= 0) {
            console.log(chalk.red(`${address} have 0 USDC`));
        } else if (res > 0) {
            console.log(chalk.yellow(`Send ${res / 10**6}USDC to ${toAddress} OKX`));
            await dataSendToken(rpc.Avalanche, chainContract.Avalanche.USDC, toAddress, res, address).then(async(res1) => {
                await sendEVMTX(rpc.Avalanche, 2, res1.estimateGas, '0', '30', '1.5', chainContract.Avalanche.USDC, null, res1.encodeABI, privateKey);
            });
        }
    });
}

const withdrawMATICToSubWallet = async(toAddress, privateKey) => {
    const address = privateToAddress(privateKey);
    await getETHAmount(rpc.Polygon, address).then(async(res) => {
        const gasPrice = parseFloat(await getGasPrice(rpc.Polygon)).toFixed(5);
        let amountETH = subtract(res, 21000 * multiply(gasPrice + 30, 10**9));
        if (amountETH > 1 * 10**16) {
            amountETH = subtract(amountETH, generateRandomAmount(1 * 10**8, 3 * 10**10, 0));
            console.log(chalk.yellow(`Send ${amountETH / 10**18}MATIC to ${toAddress} OKX`));
            await sendEVMTX(rpc.Polygon, 2, 21000, '0', gasPrice.toString(), '30', toAddress, amountETH, null, privateKey);
        } else {
            console.log(chalk.red(`Balance < 0.001 MATIC`));
        }
    });
}

const getBalance = async(privateKey) => {
    console.log(chalk.bgMagentaBright('Start Check Balance'));
    const address = privateToAddress(privateKey);

    await getETHAmount(rpc.Avalanche, address).then(async(res) => {
        await getAmountToken(rpc.Avalanche, chainContract.Avalanche.BTCB, address).then(async(res1) => {
            await getAmountToken(rpc.Avalanche, chainContract.Avalanche.USDC, address).then((res2) => {
                console.log(chalk.yellow('Avalanche ') + `AVAX: ${res / 10**18} BTCb: ${res1 / 10**8} USDC: ${res2 / 10**6}`);
            });
        });
    });
    await getETHAmount(rpc.BSC, address).then(async(res) => {
        await getAmountToken(rpc.BSC, chainContract.BSC.USDT, address).then(async(res1) => {
            console.log(chalk.yellow('BSC ') + `BNB: ${divide(res, 10**18)} USDT: ${res1 / 10**18}`);
        });
    });
    await getETHAmount(rpc.Arbitrum, address).then(async(res) => {
        await getAmountToken(rpc.Arbitrum, chainContract.Arbitrum.BTCB, address).then(async(res1) => {
            console.log(chalk.yellow('Arbitrum ')  + `ETH: ${res / 10**18} BTCb: ${res1 / 10**8}`);
        });
    });
    await getETHAmount(rpc.Polygon, address).then(async(res) => {
        await getAmountToken(rpc.Polygon, chainContract.Polygon.USDC, address).then(async(res1) => {
            console.log(chalk.yellow('Polygon ') + `MATIC: ${res / 10**18} USDC: ${res1 / 10**6}`);
        });
    });
}

//------------------------------------------------------------------------

const BTCbBridge = async(pauseTime, privateKey) => {
    const address = privateToAddress(privateKey);
    await getFeeBridgeBTC(1000, address).then(async(res) => {
        await stageBTCBridge(res.feeArbitrumBridge, res.valueArbitrumTx, res.feeAvalancheBTCBridge, res.feeAvalancheOther, pauseTime, privateKey);
    });
}

const PolygonBridge = async(pauseTime, privateKey) => {
    const address = privateToAddress(privateKey);
    await getFeeBridgeUSDCPOLY(1000, address).then(async(res) => {
        await stageUSDCPOLYBridge(res.feePolygonBridge, res.valuePolygonTx, res.feeAvalancheUSDCBridge, res.feeAvalancheOther, pauseTime, privateKey);
    });
}

const BSCBridge = async(pauseTime, privateKey) => {
    const address = privateToAddress(privateKey);
    await getFeeBridgeUSDCBSC(1000, address).then(async(res) => {
        await stageUSDCBSCBridge(res.feeBSCBridge, res.valueBSCTx, res.feeAvalancheUSDCBridge, res.feeAvalancheOther, pauseTime, privateKey);
    });
}


(async() => {
    const mainPart = [BTCbBridge, BSCBridge];
    const sendPart = [withdrawBNBToSubWallet, withdrawAVAXToSubWallet, withdrawMATICToSubWallet];
    const stage = [
        chalk.bgGrey('STAGE I MAIN BTCb Arbitrum/USDC BSC Bridge'),
        'STAGE II Bridge USDC -> Polygon -> Avalanche [20 min]',
        chalk.bgGrey('STAGE III Bridge USDC -> APTOS -> Avalanche [3-4 day]'),
        'STAGE IV Swap USDC -> AVAX',
        chalk.bgGrey('STAGE V Send BNB to Sub Wallet OKX'),
        'STAGE VI Send AVAX to Sub Wallet OKX',
        chalk.bgGrey('STAGE VIII Send MATIC to Sub Wallet OKX'),
        'STAGE VII Send Randomly BNB/AVAX/MATIC to Sub Wallet OKX',
        chalk.bgGrey('STAGE IX Get All Balance'),
    ];
    const index = readline.keyInSelect(stage, 'Choose stage!');
    if (index == -1) { process.exit() };
    console.log(chalk.green(`Start ${stage[index]}`));

    const walletETH = parseFile('private.txt');
    const walletOKX = parseFile('subWallet.txt');
    const pauseTime = generateRandomAmount(process.env.TIMEOUT_SEC_MIN * 1000, process.env.TIMEOUT_SEC_MAX * 1000, 0);
    for (let i = 0; i < walletETH.length; i++) {
        try {
            const addressAPT = privateToAptosAddress(walletETH[i]);
            console.log(chalk.blue(`Wallet ${i+1}: ${privateToAddress(walletETH[i])}  ${addressAPT}`));
        } catch (err) { throw new Error('Error: Add Private Keys!') };

        const address = privateToAddress(walletETH[i]);
        if (index == 0) {
            //MAIN PART
            shuffle(mainPart);
            for (let s = 0; s < mainPart.length; s++) {
                await mainPart[s](pauseTime, walletETH[i]);
            }
        } else if (index == 1) {
            //BRIDGE USDC POLYGON [SELL USDC AFTER CYCLE]
            await PolygonBridge(pauseTime, walletETH[i]);
        } else if (index == 2) {
            //BRIDGE USDC APTOS
            await getFeeBridgeAPTOS(1000, address).then(async(res) => {
                await stageUSDCAPTOSBridge(res.valueAPTTx, res.feeAvalancheAPTOSBridge, res.feeAvalancheOther, pauseTime, walletETH[i]);
            });
        } else if (index == 3) {
            //SWAP USDC TO AVAX
            await swapAllUSDCToAvax(pauseTime, walletETH[i]);
        } else if (index == 4) {
            //SEND BNB TO SUB WALLET OKX
            await withdrawBNBToSubWallet(walletOKX[i], walletETH[i]);
        } else if (index == 5) {
            //SEND AVAX TO SUB WALLET OKX
            await withdrawAVAXToSubWallet(walletOKX[i], walletETH[i]);
        } else if (index == 6) {
            //SEND MATIC TO SUB WALLET OKX
            await withdrawMATICToSubWallet(walletOKX[i], walletETH[i]);
        } else if (index == 7) {
            //SEND RANDOMLY BNB/AVAX TO OKX
            shuffle(sendPart);
            for (let s = 0; s < sendPart.length; s++) {
                await sendPart[s](walletOKX[i], walletETH[i]);
            }
        } else if (index == 8) {
            //GET ALL BALANCHE
            await getBalance(walletETH[i]);
        }
        await timeout(pauseTime);
    }
    console.log(chalk.bgMagentaBright('Process End!'));
})();