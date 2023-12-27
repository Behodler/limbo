# Private Network Recipe

In the deployment script, I'd previously constructed a system of recipes. A dev could declaratively deploy pieces of the ecosystem by constructing a list of prebuilt steps. The steps are defined in the Sections enum in the common file. Examples of steps are deployment of a contract, configuring a contract but they can by anything custom. If you want to create a custom step, there are a few steps to follow but it's pretty straightforward. As steps are executed, the addresses they deploy are gathered automatically so that once a recipe is complete, a file is created with a list of addresses. If a recipe fails on a step, all the preceding steps and their addresses are preserved to save gas.

In this latest commit, I wanted to distinguish testnets into public and local. Public testnets have to behave pretty much identically to mainnet. But private testnets are used mainly for building and debugging the front end. So in private, I want the ability to make vote on proposals in a matter of seconds rather than days and I want a preset list of LimboTokens listed.

This commit did just that.

## Bonus

Now that I have a recipe for deploying tokens, we also have a step by step guide for when we do it in the wild which will perhaps assist with creating governance UIs and other such dapps down the line.

It also means that if we as a community want to slam a suite of tokens onto Limbo such as a premium token (Eg. Uniswap governance token Uni) and some related LPs (Uni/SCX Uni/FLN etc), we now have a block of code written against standard ethersjs

### Special thanks

I have to give special thanks to my junior solidity dev, ChatGPT 4, without whom this would have taken much longer. $20 per month really does save an entire dev salary. I did discover that ChatGPT 4 makes mistakes and forgets things in a manner very similar to humans which was bizarre.
