# A Bayesian reading: complexity has a price

This page gives the reasoning behind the procedure in the language of model
selection and the Bayesian brain. Use it to think, **not** to compute scores:
the likelihoods below are almost never measured, and inventing them would break
rule 5. Where real data exist (a routing trial, incident records), the same
structure can be estimated honestly.

## The portfolio is a model people carry

People who operate a portfolio hold a generative model of it in their heads:
what each account, bucket, repository, channel or skill is for, who owns it,
what fails if it breaks, where a request should go. Each distinction in the
portfolio is a parameter of that model that someone must keep beliefs about.

- **Accuracy:** how well the distinctions explain what actually happens:
  requests routed correctly, incidents contained, legal and security
  requirements met.
- **Complexity:** how much belief people must hold and keep updating to use the
  distinctions. This is the cognitive burden this skill targets.

## Penalized fit: AIC and model evidence

Akaike's information criterion (Akaike, 1974) trades fit against the number of
parameters: AIC = 2k − 2 ln L. A model with more parameters must explain the
data much better to be preferred. Bayesian model evidence does the same without
an explicit count, because spreading prior belief over more parameters lowers
the probability of the data under any one setting (the Occam factor).

In variational form, the quantity a Bayesian brain is said to minimize is

  free energy = complexity − accuracy
              = KL[ posterior ‖ prior ] − E_posterior[ ln p(data | parameters) ]

Complexity is how far beliefs have to move away from the prior to fit the data.
The same structure appears in this skill:

| Skill rule | Bayesian reading |
|---|---|
| Count is a trigger, not a verdict | Parameters are fine if they buy enough accuracy |
| Question each distinction (step 1) | Does this parameter explain observations that a simpler model cannot? |
| Reduce variation before removing objects | Share one prior across a family instead of one parameter per member |
| One exception per past incident | Overfitting: a parameter added to fit one data point predicts the next one badly |
| Onboarding is slow | Out-of-sample error: newcomers meet the model without the history it was fitted to |

## Bayesian model reduction

Bayesian model reduction asks whether a model with some parameters removed (or
their priors shrunk to zero) has evidence at least as high as the full model.
If it does, the parameters are pruned. It is proposed as a picture of how brains
simplify their models, for example during sleep. Reduction in this skill is the
same question asked of a portfolio: **does removing distinction X lose more
accuracy than it saves in complexity?** Not: is X used often.

## Why invisible is not unused (rule 3)

Observing "no signal" should change belief only through the likelihood ratio

  P(no signal | X is needed) / P(no signal | X is not needed)

If telemetry was never enabled, or the kind of use cannot be logged, both
probabilities are about 1, the ratio is about 1, and belief should not move.
Silence in a channel nobody would write to when in trouble is not evidence.

## Why freeze and observe works (step 6)

A freeze with a signpost turns silence into evidence. If X is needed, a blocked
attempt or a complaint becomes likely, so P(no signal | needed) drops and the
ratio moves away from 1. Matching the window to the use cycle is what makes
P(signal within window | needed) high; a 30-day window for an annual process
leaves the ratio near 1. In active-inference terms, the freeze is an action
chosen for its epistemic value: it is taken to reduce uncertainty, not to save
anything yet.

## Why rare protection stays (rule 4)

Deciding to remove X depends on expected loss, not on the probability of use:
P(needed) × cost of not having it. A backup with a small yearly chance of use
and a catastrophic cost of absence stays, however quiet it is.

## Priors at the family level

Grouping into families (step 3) is empirical Bayes: members share a prior
learned from the family. Knowledge about how a family came to exist is prior
information. For example, when the owner says a group of similarly named items
was created while learning, the prior that their distinctions carry accuracy
should be low, and they become consolidation candidates without item-by-item
proof; protected members and named references still need checking.

## Shared models across people

When several people (or people and agents) operate one portfolio, the
distinctions are shared symbols, and reducing them renegotiates a shared model
(collective predictive coding). A distinction that only one person can explain
is a private parameter: its complexity is paid by everyone, its accuracy only by
one. Ask that person, and either share the explanation or reduce the parameter.

## Limits

- Free-energy and Bayesian-brain accounts are theories about brains, used here
  as an analogy for organizational models, not as established measurement.
- Do not report AIC, evidence or free-energy values unless they were computed
  from actual data with a stated model. A sentence naming what each distinction
  explains and what belief it costs is usually the honest form.
