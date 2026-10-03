# Ember

A Claude Code mod that follows what you and Claude are doing. Built for an ADD brain: nothing to set up and nothing to manage. It says what Claude is doing right now, whose move it is, and calls you back when it's yours.

## What it does

Ember lives in the chat itself. In the terminal:

```
✳ Reading login.ts… (4s · ↓ 146 tokens)
● Working  3 steps
```

and once Claude is done:

```
◆ Your move  2m  You asked: fix the flaky login test
```

- **The spinner line says what Claude is doing**, in plain words, where it would say "Pontificating".
- **The band above the prompt says whose move it is:** `● Working`, `● 2 agents working`, `▲ Needs your OK: Bash`, `◆ Your move`. When it's your move it also shows what you last asked, for when you come back to it. Nothing on it moves or counts seconds.
- **Subagents count as work.** While agents run, the band says so and the spinner line quotes their latest step. "Your move" and the chime wait until the last one has reported.
- **Chimes.** One when work of 20 seconds or more finishes, one when a question or permission prompt has sat for 10 seconds.
- **Idle nudge.** Five minutes after Claude finishes with no reply from you: one chime and one line in the transcript, once. The model never reads that line.

The desktop app gets the same band and transcript line; there the band also says the step, since the spinner row already does its own narrating.

Commands, all optional:

- `/ember` says it's following and whether sound is on.
- `/ember mute` and `/ember unmute` switch the chimes. The setting is kept between sessions.
- `/ember pane` opens a pane. In the desktop app it shows an animated flame that sleeps until you prompt, wakes while Claude works, bounces when Claude is blocked on you, and grows through a long stretch of work.

<table align="center">
  <tr>
    <td align="center"><img src="docs/rest.svg" width="120" alt="Ember asleep"><br><sub>asleep</sub></td>
    <td align="center"><img src="docs/work.svg" width="120" alt="Ember while Claude works"><br><sub>working</sub></td>
    <td align="center"><img src="docs/blocked.svg" width="120" alt="Ember when Claude is waiting on you"><br><sub>needs you</sub></td>
    <td align="center"><img src="docs/done.svg" width="120" alt="Ember when it is your move"><br><sub>your move</sub></td>
  </tr>
</table>

## Loading it

```bash
git clone https://github.com/nickdemari/ember.git
claude --plugin-dir ./ember
```

To load it in every terminal session, name the folder in your shell profile:

```bash
export CLAUDE_CODE_PLUGIN_DIRS="$HOME/path/to/ember"
```

In the desktop app's Code tab there is no flag to pass. Ask Claude to load its `plugin-authoring` skill and copy this folder into the session's mods folder, then pick **Enable for this session** when asked.

Ember is written against the function-hooks plugin API of Claude Code 2.1.286. That API is early access: it can change between releases, and whether hooks modules load at all depends on your version and account.

## Checking a change

```bash
npx -p typescript tsc -p .
claude plugin validate .
claude plugin test .
```

`tsc` needs `.claude-plugin/types/`, which the engine writes the first time it loads the mod.

## Layout

- `hooks/register.tsx`: every hook, the band and the pane.
- `hooks/creature.ts`: the flame as one SMIL-animated SVG per mood, and the caption beside it.
- `hooks/narrate.ts`: tool calls in plain words.
- `types/index.d.ts`: the state contract.
- `fx/`: the chime.

## License

MIT
