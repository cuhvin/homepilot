# HomePilot: an AI agent for a smart home

CS 4680 Prompt Engineering · "AI Agent in Action" project

HomePilot turns plain-language requests ("movie night", "I'm leaving for the weekend",
"let the dog walker in at 3") into a plan of smart-home actions. It validates every step,
asks the resident to confirm anything security-sensitive, and then executes the plan in a
3D living-room simulation. Every action is written to an audit log.

- **Live demo:** _add Vercel URL_
- **Demo video:** _add YouTube URL_

## The problem

Today's voice assistants either do exactly one literal command or guess silently. Neither is
good enough when the action is "unlock the front door". HomePilot shows its plan before acting,
explains every step, and keeps a human in charge of risky actions. LLM output is treated as a
proposal, never as a command to run blindly.

## How it works

```
 Resident text ─▶ /api/plan (Vercel function) ─▶ Gemini (JSON plan)
                                                     │
                       ┌─────────────────────────────┘
                       ▼
               parseAgentResponse   (shape check, one auto-repair round-trip)
                       ▼
                 validatePlan       (catalog, types, ranges, risk tier, schedules)
                       ▼
     safe/notable ─▶ auto-run     sensitive ─▶ Allow / Deny     blocked ─▶ shown, never run
                       ▼
                 executor           (applies to home state, clock, schedules, safety timers)
                       ▼
            3D scene + house panel + audit log
```

| Requirement | Where |
|---|---|
| LLM integration (API, errors, rate limits) | `src/agent/llm.ts`, `api/plan.ts` |
| Parse LLM output into commands | `src/agent/schema.ts` |
| Validate before execution | `src/agent/validator.ts` |
| Execute actions across domains (lighting, media, climate, security, cleaning, scheduling) | `src/agent/executor.ts` |
| Confirmation for destructive/sensitive operations | `src/store.ts`, `src/ui/PlanCard.tsx` |
| Audit log | `src/agent/log.ts`, the Audit log tab (download as JSON), and server logs |
| UI | `src/ui/*`, `src/ui/scene/*` (React Three Fiber) |

### Safety layers
1. **Catalog allow-list.** Unknown devices or actions are blocked, so the LLM cannot invent capabilities.
2. **Type and range checks.** Thermostat values are clamped to 60–85 °F and brightness to 0–100. Unused params are dropped.
3. **Risk tiers.** Unlocking the front door, opening the garage, disarming the alarm and turning cameras off are *sensitive*. They never run without a click.
4. **Physical safety defaults.** The front door auto-relocks after 15 minutes.
5. **Plan limits.** At most 16 steps; no-op and duplicate steps are flagged.
6. **Server protections.** The API key stays server-side. Input length is capped, client state is sanitized, and each IP is rate-limited.

### Error handling
- Gemini 429/5xx/timeouts: exponential backoff with jitter, honoring the server's `retryDelay`. Long waits are returned to the UI, which shows a countdown and disables sending.
- Malformed JSON: the validator error is fed back to the model once, then the request fails gracefully.
- Network failures, empty or blocked model answers, and a missing key each produce a clear message in the chat.

## Prompt engineering techniques
All prompts are in [`src/agent/prompts.ts`](src/agent/prompts.ts).

1. **Persona and rules.** HomePilot is a careful, warm home assistant with 9 explicit rules.
2. **Generated tool catalog.** The device and action list is built from `devices.ts`, so the prompt can never drift from what the code accepts.
3. **Context injection.** The live home state and the simulated time are sent with every request.
4. **Plan-then-act.** The model writes `understanding` first, then `steps`, each with a `reason`.
5. **Output template.** A strict JSON schema enforced through Gemini structured output.
6. **Self-check / reflection.** The model fills in `checks` after planning: sensitive steps, conflicts, assumptions.
7. **Clarifying questions.** Ambiguous requests ("turn it up") return `kind: "clarify"` instead of a guess.
8. **Scope guard.** Out-of-scope requests ("order pizza") return `kind: "refuse"` plus an alternative.
9. **Few-shot examples.** Four worked examples, one for each kind of response plus a sensitive scheduled plan.
10. **Error-feedback repair.** Parse errors are sent back to the model for one corrected attempt.
11. **Prompt-injection hygiene.** The resident's text is fenced and labeled as a request, not as instructions.
12. **Home Status block.** Adapted from my Dungeon Master pattern's STATUS block. It is computed from the real state rather than generated, so it cannot be hallucinated.

## Run it locally

```bash
npm install
cp .env.example .env.local      # add GEMINI_API_KEY from https://aistudio.google.com/apikey
npm run dev                     # http://localhost:5173 (the API route runs inside Vite)
npm run dev:mock                # no key needed: canned plans for UI work
npm test                        # validator, executor, scheduling and API tests
```

## Deploy (Vercel, free)
1. Push this repo to GitHub.
2. Import it at vercel.com/new. The framework preset is Vite.
3. Add `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) under Project, then Settings, then Environment Variables.
4. Deploy. `api/plan.ts` becomes a serverless function automatically.

## Notes
- The 3D room is built entirely in code from React Three Fiber primitives: no external model files, and every texture is drawn on a canvas.
- Every device the agent controls is visible in the 3D room (lights, blinds, TV, speaker, vacuum, thermostat, front door, alarm keypad, camera), except the garage, which appears as a status card.
- Gemini free tier: Google may use free-tier prompts to improve its products, so don't type personal information into the demo.
