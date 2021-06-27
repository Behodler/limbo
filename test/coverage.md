# DAO
## Staking
- [x] Only approved assets can be staked
- [x] Only live staking
- [x] Staking Eye sets fate per day to root EYE 
- [x] Staking Eye and wait increases fate correctly
- [x] Staking LP set eye to 2 root eye balance
- [x] Adjusting eye stake down releases eye and sets fate per day correctly
- [x] Adjusting eye stake up takes more eye and sets fate per day correctly
- [x] Adjusting LP stake down releases eye and sets fate per day correctly
- [x] Adjusting LP stake up takes more eye and sets fate per day correctly

- [x] Staking, getting fate and then changing stake and waiting ends up with correct fate
- [x] Staking multiple asset types sets fate rate correctly
- [x] Test burning EYE and burning LP to get much higher votes


## Proposals
- [x] Insufficient fate to lodge rejected
- [x] Lodging proposal while existing proposal valid rejected
- [x] lodging proposal when none exist accepted
- [x] Lodging proposal while existing proposal expired accepted
- [x] Voting yes on current proposal accepts it after duration, can then be executed
- [x] voting no on current proposal makes it unexecutable.
- [x] asset approval proposal can add and remove approved assets
- [x] Voting that flips extends cut off


## Limbo
**old souls**
- [x] old souls can be claimed from
- [x] old souls can be bonus claimed from
- [x] perpetual pools have no upper limit

**Config**
- [x] populating crossingConfig with configureCrossingConfig
- [ ] use flashGovernance to adjustSoul
- [ ] flashGovernance adjust configureCrossingParameters
- [ ] reverse fashGov decision and burn asset
- [ ] shutdown soul staking and withdraw tokens
- [ ] protocol disabled blocks all functions

**staking** 
- [ ] unstaking rewards user correctly and sets unclaimed to zero
- [ ] staking/unstaking only possible in staking state.
- [ ] staking an invalid token fails
- [ ] aggregate rewards per token per second aligns with configuration and adds up to flan per second.
- [ ] unstaking with exitPenalty > 1000 reverts with E3
- [ ] unstaking amount larger than balance reverts with E4
- [ ] unstaking with exitPenalty > 0 incurs penalty on claims  

**claims**
- [ ] claims disabled on exitPenalty>0
- [ ] claiming staked reward resets unclaimed to zero
- [ ] claim rising bonus 
- [ ] claim falling bonus 
- [ ] claim bonus disabled during staking
- [ ] claiming bonus twice fails.
- [ ] claiming negative bonus fails

**migration governance**
- [ ] withdrawERC20 fails on souls
- [ ] withdrawERC20 succeeds on non listed tokens or previously listed tokens.
- [ ] migration fails on not waitingToCross
- [ ] stamping reserves requires wait to pass before migration
- [ ] too much reserve drift between stamping and execution fails (divergenceTolerance)
- [ ] only threshold souls can migrate
- [ ] SCX burnt leaves rectangle of fairness.
- [ ] Flan price and liquidity higher post migration.
- [ ] soul changed to crossedOver post migration
- [ ] token tradeable on Behodler post migration.
- [ ] flash governance max tolerance respected
- [ ] not enough time between crossing and migration