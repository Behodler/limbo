## Deployment script extracts token details
For every network, the protocol contracts are always the same set but the tokens and pyroTokens differ.
The UI needs to be automatically aware of this distinction and the UI devs (we're both on it now) need to write code that expects the same protocol contracts but awaits a list of specific tokens and pyroTokens.

This commit updates the deployment script to split the contracts into 2 sets, one flat protocol token list and the other an array of token/pyroToken groupings. The tokens aren't removed from the original protocol token set but they can be safely ignored by the UI.

In the next commit, the dev server will be updated to have an additional end point that will produce the network specific set of token/pyroToken details
This will allow for rapid integration into the UI project.

Form there the UI project can have a big JSON file for public networks and can call the dev server for dev. However, above that abstraction, it's 2 sets of addresses used throughout the UI project. This will facilitate a rapid refactoring so we can get the show on the road.

# TODO on this branch
1. Add endpoint to dev-env server
2. Prompt Shan Australia to provide more memes. (Community can help with this)