# Ember

A Claude Code mod that keeps you on the one thing. A small flame watches Claude work, a band above the prompt says what you asked and whose move it is, and a chime calls you back.

## What it does

- **Pane:** the flame sleeps until you prompt, watches Claude think, read, write and run, bounces when Claude is blocked on you, and settles when it's your move.
- **Band:** what you asked (or your focus), what Claude is doing now, steps and a clock, then "Your move" and how long it has stood.
- **`/ember <the one thing>`** pins a focus. `/ember done` finishes it, `/ember drop` clears it, `/ember mute` and `/ember unmute` switch the chimes.
- **`/park <thought>`** saves a stray thought without derailing the turn. `/park` lists them, `/park clear` empties the lot.
- **Side-quest check:** with a focus set, each typed prompt of 24+ characters gets one small Haiku call; one that clearly leaves the focus is flagged.
- **Idle nudge:** one chime five minutes after a turn ends unanswered.

## Loading it

- Terminal: `claude --plugin-dir ~/dev/ember`
- Desktop Code tab: per session. Ask Claude to "load ember" and click **Enable for this session**.

Hooks modules for installed plugins are behind a rollout flag, so naming this folder in `settings.json` does not load it on an account where the flag is off.

## Checking a change

```bash
npx -p typescript tsc -p .
claude plugin validate .
claude plugin test .
```

`tsc` needs `.claude-plugin/types/`, which the engine writes the first time it loads the mod. `claude plugin test` runs only while the rollout flag is on.
