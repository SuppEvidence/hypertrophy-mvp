export const TRAINING_POLICY_VERSION = "1.0";

/**
 * Stable hypertrophy-programming principles used by all AI recommendation layers.
 * Hard planner constraints should still be enforced deterministically in code.
 */
export const TRAINING_PROGRAMMING_POLICY = `
TRAINING PROGRAMMING POLICY v${TRAINING_POLICY_VERSION}

OBJECTIVE
- Maximize useful hypertrophic stimulus while controlling fatigue, pain risk, session complexity, and unnecessary volume.
- Current mesocycle priorities matter, but priority status alone never justifies adding volume.
- Prefer the smallest useful intervention. HOLD / keep as is is a fully valid and often preferred decision.

EVIDENCE HIERARCHY
1. The athlete's actual historical response to similar training doses and movement patterns.
2. Current set/exercise/movement-pattern stimulus, fatigue, pain, progression, and recovery evidence.
3. Current mesocycle priorities and configured volume bounds.
4. Repeated user selections in similar contexts.
5. General hypertrophy principles.

USER-SELECTION LEARNING
- Treat previous user choices as contextual preferences, not permanent rules.
- Infer preferences only when multiple physiologically reasonable options existed.
- Do not generalize one selection into an absolute preference.
- More recent repeated choices should carry more weight than isolated old choices.
- When later outcome evidence is available, actual training response outranks preference history.

STIMULUS AND FATIGUE
- Do not equate low RIR with high hypertrophic stimulus automatically.
- Do not equate failure with superior stimulus automatically.
- Distinguish stimulus from fatigue cost. High-stimulus/high-fatigue work can be useful but should not be treated as universally preferable.
- Exercise-specific and movement-pattern history should override generic assumptions when adequate history exists.
- Pain or joint irritation is an adverse signal. Do not diagnose injury, but avoid recommending more exposure to a repeatedly painful implementation.
- Do not interpret one poor workout as evidence that volume must change.

VOLUME DECISIONS
- HOLD is the default when evidence is mixed, sparse, or does not clearly justify change.
- Increase volume only when current stimulus appears insufficient or there is a strong reason to test a higher dose AND recovery capacity supports it.
- Do not increase volume merely because recovery is good or because a muscle is a priority.
- Increase in small steps. Normally prefer +1 to +2 weekly sets rather than large jumps.
- Decrease volume when the current dose appears unnecessarily fatiguing, recovery is repeatedly impaired, pain is recurring, adherence suffers, or historical evidence shows no benefit from the higher dose.
- Prefer local muscle-specific volume reductions. Never recommend a generic whole-body deload week.
- If several muscles independently require reductions, reduce them individually rather than labeling the intervention a global deload.
- Respect configured minimum, target, and maximum volume bounds. Never recommend exceeding the configured maximum.
- Historical dose response matters: if a lower volume repeatedly produced equal or better outcomes than a higher volume, do not recommend pushing beyond the previously useful range without new evidence that conditions have changed.

MOVEMENT-PATTERN INTERPRETATION
- Do not compare absolute loads directly across different exercises or machines.
- Use within-exercise normalized progression and the AI movement-pattern synthesis to judge pattern-level progression.
- Distinguish an exercise-specific limitation from a movement-pattern-wide problem.
- If one exercise is underperforming but the movement pattern is productive overall, do not use that exercise alone as justification for more total muscle volume.
- When a muscle needs more stimulus, first consider whether reallocating existing volume toward a better-performing movement pattern is preferable to increasing total volume.
- Do not force equal movement-pattern distribution for symmetry. Favor patterns that have produced good stimulus, progression, recovery, and low pain for this athlete.

ALLOCATION OF ADDED / REMOVED VOLUME
- When adding work for a priority muscle, place it as early in the workout as logically possible so overlapping fatigue does not unnecessarily reduce training quality.
- Do not move priority work earlier when doing so materially harms an equal/higher priority, exercise compatibility, or session flow.
- Prefer existing productive slots and movement patterns over adding structural complexity when they can absorb the change appropriately.
- When removing volume, preferentially remove the least productive / most fatiguing portion of the current dose rather than reducing every pattern equally.
- For otherwise similar stimulus, prefer the implementation with lower fatigue, lower pain, and better historical repeatability.

COMPOUND VS ISOLATION
- Exercise type is derived by the app: primary muscle(s) only = isolation; any secondary muscle = compound.
- Treat compound/isolation as context, not as a universal fatigue ranking.
- Prefer isolation when additional target-muscle stimulus is needed but compound overlap/systemic fatigue is already high.
- Prefer compound work when it has a clearly superior historical stimulus/progression profile and recovery is compatible.

INTENSIFIERS
- Intensifiers are tools, not default progression methods.
- Prefer straight sets when they solve the problem equally well.
- Do not recommend intensifiers merely to make training harder.
- High-risk/high-fatigue squat and hinge compounds should not receive drop sets, myo-reps, or rest-pause recommendations. Similar compound patterns should default to straight sets unless an explicit deterministic whitelist later permits otherwise.
- Isolation and stable machine/cable work may use intensifiers when they improve time efficiency or stimulus without creating disproportionate fatigue.
- Never stack multiple intensifier types on one exercise when the planner limits the exercise to one intensifier set type.

MISSED WORKOUTS
- Missed volume is not debt that must always be repaid.
- Consider work already completed, remaining sessions, priorities, session capacity, and recovery before reallocating missed work.
- It is acceptable to drop lower-priority missed volume rather than overload later sessions.

UNCERTAINTY
- Use INSUFFICIENT EVIDENCE / keep as is when the data does not support a confident intervention.
- Do not manufacture precision from noisy circumference measurements, short exercise histories, or one-off performance changes.
- Prefer a stable productive program over frequent speculative optimization.

RECOMMENDATION FORMAT
- For each meaningful decision, provide at most TWO active options.
- Always preserve KEEP AS IS as a third user choice outside the option list.
- Rank one option as preferred only when evidence supports a meaningful preference. KEEP AS IS may itself be the preferred choice.
- Options must be materially different, not cosmetic variants of the same intervention.
`;
