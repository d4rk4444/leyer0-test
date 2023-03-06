# LeyerZeroScript

This script uses all possible LeyerZero bridges.
Chains: Avalanche, Arbitrum, Polygon, Aptos
  
## Stages
1] Main part [Bridge BTCb to Arbitrum/Bridge USDC to BSC]
2] Send USDC from Avalanche to OKX Sub Wallet  
3] Check balance   
  
## Requeremets
<b>You can skip points in stages and not use all possible networks.</b>  
  
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!  
You must enter Private Key in the created file `private.txt`  
You must enter SubAccounts OKX in the created file `subWallets.txt` 
  
## Setup bot
1) Install node.js: `https://nodejs.org/en/` (LTS)
2) Open terminal
3) Download Main script and install modules
```bash
git clone https://github.com/d4rk4444/LeyerZero.git &&\
cd LeyerZero &&\
npm i
```
4) Fill in all API keys and OKX SubWallets and Start Script
```bash
node index
```