# Hongbao

Hongbao is a web3 ZKP application that anyone can setup a donation campaign while keeping the donors’ activities completely anonymous. 
 
## Problem Statement

When people ask friends to do a favor on emergent finance need (for example: curing a disease) or organize a group giving (for example: wedding wish list). Such donation activities are done publicly, i.e., the requester and (probably) the donators can see who and how much each friend donate. This causes social pressure on some friends, who for some reason, may either don’t want to give or can’t afford the amount other friends give. It also introduces unhealthy competition environment and encourage displaying of loyalty by money.

## ZK Solution

The application is based on [Tornado.cash](https://github.com/tornadocash/tornado-core) source code with the migrations to latest circom (2.0.3) and snarkjs (0.4.16). Asker uses this app to setup a campaign, then send the campaign link to friends via social network. Her friends can then follow the link to transfer fund anonymously. The requester can see how many people and how much in total made to this campaign but can never find out individual donation (who and by how much).

Technically, Hongbao uses zkSnarks to shield fund transfer, thus hides donors’ activity. 

## Component

- Hongbao-core: zkSnark circuits and smart contracts that compose the core logic of this applicatin.
- Hongbao-UI (under development): a ReactJs based web application.
- Hongbao-relayer (under development): relay withdraw request (with zk-proof) to campaign.

## Requirements

1. `node v14+`
2. `circom 2.0.3`

## Local Setup & Test

1. `cp .env.example .env` and change the parameters accordingly
1. `npm run build`
1. `npm run test`

## 
## Harmony Deployment

### TestNet

`npm run migrate:test`

#### Already Deployed
1. Verifier: `0x79D4F93F7b32cC36E40f27Ca182d67992dCbfa6a`
1. Hasher: `0x425089477576De6Fb35AC51820e7B250361F566c`
1. ETHTornado: `0x4731EA3241bbF369Cc4A4EC1382f85a03A9b2A7f`
1. CampaignManager: `0x0DaFFB58B0Bb80e592b15766eDF2EB8CCB846E0C`


### MainNet

`npm run migrate:mainnet`
