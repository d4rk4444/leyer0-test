# LeyerZeroScript

This script uses all possible LeyerZero bridges.
Chains: Avalanche, Arbitrum, Polygon, Aptos
  
## Stages
1] Main part [Bridge BTCb to Arbitrum/Bridge USDC to BSC]     
2] Bridge USDC to Polygon    
3] Bridge USDC to Aptos     
4] Swap USDC to AVAX      
5] Send All BNB to SubWallet     
6] Send All AVAX to SubWallet   
7] Send All MATIC to SubWallet   
8] Send Randomly All BNB/AVAX/MATIC to SubWallet    
9] Get Balance    
  
## Requeremets
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!  
Enter Private Key in the created file `private.txt`    
Enter SubAccounts OKX in the created file `subWallets.txt`      
  
## Setup bot
1) Install node.js: `https://nodejs.org/en/` (LTS)           
2) Open terminal         
3) Download Main script and install modules     
```bash
git clone https://github.com/d4rk4444/leyer0-test.git &&\
cd leyer0-test &&\
npm i
```
4) Fill in all API keys and OKX SubWallets and Start Script      
```bash
node index
```