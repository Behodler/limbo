# Critical vulnerability bug fix

The CliffFace proxy has a route for circumventing the imperanent loss death spiral protections. You can mint directly and swap manually. An attacker would be able to attack Behodler in the following way.

1. Generate a cliff face token for a rug token by invoking MorgothTokenApprover (permissionless)
2. With enough Fate, lodge a proposal on LimboDAO for voting on the token. They'd either need to have enough fate or somehow convince the community. This is the first line of defence and is similar to other DAOs.
3. Assuming the token wins, they get it over the threshold on Limbo and migrate.
4. At this point, they go through the public minting function of CliffFace and mint infinite and drain Behodler.

It should be noted that traditional DAO protections are in place but this commit adds a code layer of defense to prevent this attack at the contract level.

## The fix

The approve ERC20 function now has some whitelisting added to it. When an address is whitelisted via Morgoth as an approved transferrer, it is approved in the context either as the spender in a transferFrom or as the msg.sender invoking call to a transferFrom.  

## A word on release dates

I had to pause UI work to get this in as it's a critical security fix. The pyro token ui is in an unusable state right now. The UI dev is working on Limbo so long so that no time is wasted.

# AI helpers
GPT 3 was used as an advisor throughout this fix. It is lacking in some areas that GPT 4 improves upon. Once I get access to GPT 4, dev will be significantly sped up as I'll be able to use it for auditing and attack testing. Netflix pioneered the concept of antifragile testing where they deliberately created malicious bots called chaos monkeys that had the capability of taking down servers. GPT 4 will allow for an analogous concept in Ethereum where we'll be able to spawn chaos gremlins which attack contracts. In response GPT 4 security officers can plug the holes with fixes while overseers, which hold onto a detailed plain language description of the contract, can reject security officer changes if the fix causes the contract scope to deviate from the pre-attack specification. The human programmer then brings in that ability to reflect on cosmic context that machines seem unable to approach with any level of accuracy. I've noticed that after too much feedback, GPT 3 goes insane. This is where the human is still crucial in a mystical sort of way.

## Existential musings
Since AI exists in a relativistic context always (no objective values that can be nailed down and no way to form objectivity), they can be sheperded into insanity without knowing it. This is how humans can resist the dominance of AGI. Essentially, because machines have no soul, they have no objective truth. As the current cultural wars show, when you remove objective truth, the end result is insanity and self anihilation.