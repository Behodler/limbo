# Recipes
Until now, we had a way of customizing the list of deployment sections to run and the order that they were run in by manually altering the SectionsToList array in common.ts. This means that although we have flexibility, there's a bit of hardcored wrangling going on.
This commit simply refactors the existing functionality into a public function that takes a parameter specifying a recipe. A recipe is a custom list of deployment steps. Right now we have testnet (which deploys everything), statusQuo (replicates the current mainnet state) and so on.

If you want to deploy a custom recipe, simply call orchestrate's safeDeploy function which now contains a parameter for recipe name. The chainID will then decide where this recipe is deployed.

