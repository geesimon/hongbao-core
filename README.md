# Hongbao

Hongbao is a web3 ZKP application that anyone can setup a donation campaign while keeping the donors’ activities completely anonymous. 
 
## Problem Statement

When people ask friends to do a favor on emergent finance need (for example: curing a disease) or organize a group giving (for example: wedding wish list). Such donation activities are done publicly, i.e., the requester and (probably) the donators can see who and how much each friend donate. This causes social pressure on some friends, who for some reason, may either don’t want to give or can’t afford the amount other friends give. It also introduces unhealthy competition environment and encourage displaying of loyalty by money.

## ZK Solution

The application is based on [Tornado.cash](https://github.com/tornadocash/tornado-core) source code with the migrations to latest circom (2.0.3) and snarkjs (0.4.16). Asker uses this app to setup a campaign, then send the campaign link to friends via social network. Her friends can then follow the link to transfer fund anonymously. The requester can see how many people and how much in total made to this campaign but can never find out individual donation (who and by how much).

Technically, Hongbao uses zkSnarks to shield fund transfer, thus hides donors’ activity. 

## Component

- Hongbao-core (this repository): zkSnark circuits and smart contracts that compose the core logic of this applicatin.
- [Hongbao-UI](https://github.com/geesimon/hongbao-ui): a ReactJs based web application.
- Hongbao-relayer: relay withdraw request (with zk-proof) to campaign.

## Requirements

1. `node v14+`
2. `circom 2.0.3`

## Local Setup & Test

1. `cp .env.example .env` and change the parameters accordingly
1. `npm run build`
1. `npx truffle develop`
  * `migrate --reset`
  * `test`

## Usage

Please check [test cases](https://github.com/geesimon/hongbao-core/blob/main/test/3_CampaignManager.test.js)

## Harmony Deployment

### TestNet

`npm run migrate:test`

#### Already Deployed
1. Verifier: `0x586a291c9cb9b0c28B3342b23Bea20ccC7dB16f2`
1. Hasher: `0xD29a337819c555cfaC8d3ec2709e5A1802197f71`
1. ETHHongbao: `0x9c8AC5daf77F77593A18ed6b2Fc660785b30963F`
1. CampaignManager: `0xb4b99e1a14281233AE57BC39c97D9e0585676249`


### MainNet

`npm run migrate:mainnet`
