/* global artifacts */
require('dotenv').config({ path: '../.env' })
const ETHTornado = artifacts.require('ETHTornado')
const CampaignManager = artifacts.require('CampaignManager')

module.exports = function (deployer) {
  return deployer.then(async () => {
    const tornado = await ETHTornado.deployed();
    const campaignManager = await deployer.deploy(
        CampaignManager,
        [tornado.address]
    )
  })
}
