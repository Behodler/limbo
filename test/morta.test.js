const { expect } = require("chai");

describe("Morta", function() {
  it("blank test", async function() {
    const Morta = await ethers.getContractFactory("Morta");
    const morta = await Morta.deploy();
    
    await morta.deployed();
  });
});
