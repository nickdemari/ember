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

In the terminal Ember lives in the chat itself:

```
✳ Reading login.ts… (4s · ↓ 146 tokens)
(•ᴗ•)⟳  ▸ Ship the login fix · 12m  ● 3 steps
```

- **The spinner line says what Claude is doing**, in plain words, where it would say "Pontificating".
- **The band above the prompt is the creature's home.** A small face that sleeps until you prompt, moves while Claude works, asks `?` on a side quest and waves when it's your move, beside what you asked (or your focus) and whose move it is.
- **Side quests and nudges are lines in the transcript**, where you'll see them when you come back. The model never reads them.

In the desktop app the same band is joined by a pane with the animated flame above, which grows the more turns you stay on one focus.

Everywhere:

- **`/ember <the one thing>`** pins a focus. `/ember done` finishes it with a small celebration, `/ember drop` clears it, `/ember mute` and `/ember unmute` switch the chimes. `/ember` alone opens the pane.
- **`/park <thought>`** saves a stray thought without derailing the turn. `/park` lists them, `/park clear` empties the lot, and one press in the pane turns a parked thought into the next focus.
- **Chimes.** One when a turn of 20 seconds or more finishes, one when a question or permission prompt has sat for 10 seconds.
- **Side-quest check.** With a focus set, each typed prompt of 24 or more characters gets one small Haiku call. A prompt that clearly leaves the focus is flagged in the band, on the creature and in the transcript. It never blocks the prompt.
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
- `hooks/creature.ts`: the flame as one SMIL-animated SVG per mood, plus a text face for the terminal.
- `hooks/narrate.ts`: tool calls in plain words.
- `types/index.d.ts`: the state contract.
- `fx/`: the two chimes.

## License

MIT
