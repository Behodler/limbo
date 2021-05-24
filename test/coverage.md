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