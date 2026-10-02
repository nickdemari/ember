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

- **Pane.** The flame sleeps until you prompt, watches Claude think, read, write and run, bounces when Claude is blocked on you, and settles when it's your move. It grows the more turns you stay on one focus.
- **Band above the prompt.** What you asked (or your focus), what Claude is doing right now, a step count and a clock, then "Your move" and how long it has stood.
- **`/ember <the one thing>`** pins a focus. `/ember done` finishes it with a small celebration, `/ember drop` clears it, `/ember mute` and `/ember unmute` switch the chimes.
- **`/park <thought>`** saves a stray thought without derailing the turn. `/park` lists them, `/park clear` empties the lot, and one press in the pane turns a parked thought into the next focus.
- **Chimes.** One when a turn of 20 seconds or more finishes, one when a question or permission prompt has sat for 10 seconds.
- **Side-quest check.** With a focus set, each typed prompt of 24 or more characters gets one small Haiku call. A prompt that clearly leaves the focus is flagged in the band, on the flame and in a toast. It never blocks the prompt.
- **Idle nudge.** One chime five minutes after a turn ends unanswered, once.

Parked thoughts and the mute setting are kept between sessions. Everything else lives for the session.

## Loading it

```bash
git clone https://github.com/nickdemari/ember.git
claude --plugin-dir ./ember
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
- `hooks/creature.ts`: the flame as one SMIL-animated SVG per mood, plus a text face for the terminal.
- `hooks/narrate.ts`: tool calls in plain words.
- `types/index.d.ts`: the state contract.
- `fx/`: the two chimes.

## License

MIT
