import { expect } from "chai";
import { ethers } from "hardhat";

describe("Example", function () {
    it("Should return the new greeting once it's changed", async function () {
        const Example = await ethers.getContractFactory("Example");
        const example = await Example.deploy("Hello, world!");

        expect(await example.greeting()).to.equal("Hello, world!");

        await example.setGreeting("Hola, mundo!");
        expect(await example.greeting()).to.equal("Hola, mundo!");
    });
});
