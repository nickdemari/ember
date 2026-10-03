# Ember

A Claude Code mod that keeps you on the one thing. Built for an ADD brain: a small flame watches Claude work, a band above the prompt says what you asked and whose move it is, and a chime calls you back when you've wandered off.

<table align="center">
  <tr>
    <td align="center"><img src="docs/rest.svg" width="120" alt="Ember asleep"><br><sub>asleep</sub></td>
    <td align="center"><img src="docs/think.svg" width="120" alt="Ember while Claude thinks"><br><sub>thinking</sub></td>
    <td align="center"><img src="docs/write.svg" width="120" alt="Ember while Claude writes"><br><sub>writing</sub></td>
    <td align="center"><img src="docs/run.svg" width="120" alt="Ember while Claude runs things"><br><sub>running</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/blocked.svg" width="120" alt="Ember when Claude is waiting on you"><br><sub>needs you</sub></td>
    <td align="center"><img src="docs/side-quest.svg" width="120" alt="Ember asking whether this is a side quest"><br><sub>side quest?</sub></td>
    <td align="center"><img src="docs/done.svg" width="120" alt="Ember when it is your move"><br><sub>your move</sub></td>
    <td align="center"><img src="docs/cheer.svg" width="120" alt="Ember celebrating a finished focus"><br><sub>done</sub></td>
  </tr>
</table>

## What it does

Ember lives in the chat itself. In the terminal:

```
✳ Reading login.ts… (4s · ↓ 146 tokens)
● Working  3 steps  ▸ Ship the login fix  12m
```

- **The spinner line says what Claude is doing**, in plain words, where it would say "Pontificating".
- **The band above the prompt says whose move it is**, then what you asked or your focus: `● Working`, `● 2 agents working`, `▲ Needs your OK: Bash`, `◆ Your move · 2m`. Nothing on it moves or counts seconds.
- **Subagents count as work.** While agents run, the band says so and the spinner line quotes their latest step. "Your move" and the chime wait until the last one has reported.
- **Side quests and nudges are lines in the transcript**, where you'll see them when you come back. The model never reads them.

The desktop app gets the same band and transcript lines; there the band also says the step, since the spinner row already does its own narrating.

Nothing opens by itself, and `/ember` on its own answers in the chat with where your focus stands. `/ember pane` opens a pane with your focus, parked thoughts and the sound switch, and in the desktop app the animated flame above: it sleeps until you prompt, wakes while Claude works, bounces when Claude is blocked on you, and grows the more turns you stay on one focus.

Everywhere:

- **`/ember <the one thing>`** pins a focus. `/ember done` finishes it with a small celebration, `/ember drop` clears it, `/ember mute` and `/ember unmute` switch the chimes. `/ember` alone says where things stand.
- **`/park <thought>`** saves a stray thought without derailing the turn. `/park` lists them, `/park clear` empties the lot, and one press in the pane turns a parked thought into the next focus.
- **Chimes.** One when a turn of 20 seconds or more finishes, one when a question or permission prompt has sat for 10 seconds.
- **Side-quest check.** With a focus set, each typed prompt of 24 or more characters gets one small Haiku call. A prompt that clearly leaves the focus is flagged in the band, on the flame and in the transcript. It never blocks the prompt.
- **Idle nudge.** One chime five minutes after a turn ends unanswered, once.

Parked thoughts and the mute setting are kept between sessions. Everything else lives for the session.

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
- `fx/`: the two chimes.

## License

MIT
