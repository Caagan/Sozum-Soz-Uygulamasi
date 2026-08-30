# SÖZÜM SÖZ — Digital Well-Being Prototype (Hackathon Report)

## 1. Problem Statement

Smartphone use has shifted from intentional to automatic: feed-based applications are built to
keep the user scrolling, time boundaries blur, and users routinely overstay their own self-set
limits — especially late at night and around fatigue (Yeşilay 2026 Digital Addiction reports
document the same triggers in messaging/social/video categories). Our target user is the young
adult or student who *wants* healthier digital habits but lacks an external, non-judgmental
structure.

**Our tool in one sentence:** every time the user opens an app, SÖZÜM SÖZ ("I promise") asks *how
long do you want to stay*, tracks the session, and a generative-AI coach reflects on the user's own
data, suggests realistic microbreaks, and helps build healthier routines — without ever making a
medical claim.

We combine a behavioral **commitment device** (state a duration before use) with **generated,
personalized guidance** (daily/weekly reflection, coach notifications, a multi-turn coaching chat)
and **gentle gamification** (points, streaks, weekly challenges, a reward catalog). Originality:
the generative AI never lectures; it works on the user's own log, converts aggregate numbers into
"pattern → trigger → small experiment" language.

## 2. Model & Integration

- **Technique:** direct API calls from the browser. Two selectable providers in Settings:
  **OpenAI-compatible chat completions** (default `gpt-4o-mini`) and **Google Gemini**
  (`gemini-3.6-flash` via `generateContent`); custom/fine-tuned model names are accepted.
- **Offline-first:** without an API key the app runs fully on deterministic template responses that
  mirror the prompt constraints, so the prototype works end-to-end in any demo.
- **On-device data:** everything is stored in `localStorage`; the API receives only anonymized
  aggregates (session counts, kept/broken promises, top apps), never identity.

## 3. Prompt Design (most important prompts + rationale)

We used three techniques from the module and document each:

1. **Zero-shot — system prompts.** `SÖZÜM SÖZ` ("systemPrompt", `chatSystem`, `coachSystem`)
   define the role (non-judgmental well-being coach) and 9 hard rules: no clinical or
   stigmatizing vocabulary ("addict", "patient", "treatment"), no blame, structure
   `pattern → trigger → small experiment`, use *only* numbers present in the data, concrete
   suggestions, always Turkish, mandatory "not medical advice" disclaimer, crisis
   routing to 115/112, and off-topic refusal (financial/news/recipe questions are politely
   steered back to screen habits — the tool stays in scope). *Why:* these rules are our
   strongest guard against the two risks the brief names — judgmental tone and overclaiming —
   and keep the conversation focused.
2. **Few-shot / one-shot — daily reflection and coach JSON.** `buildDaily` feeds the aggregated
   JSON plus one annotated *example of a correct answer* before instructing the model; the coach
   prompt constrains the output to a strict JSON shape `{title, body, breakOffer, points}` with a
   worked example. *Why:* the example anchors tone and structure so output is renderable and
   consistent regardless of model.
3. **Structured step-by-step — weekly summary.** `buildWeekly` explicitly commands a chain:
   step 1 summarize non-judgmentally → step 2 pick the two strongest *patterns* → step 3 propose
   two flexible boundaries (explicitly not "1 hour/day" orders) → step 4 encouraging, realistic
   close + disclaimer. *Why:* the fixed agenda reduces hallucinated advice and keeps the summary
   scannable and safe.

Prompts are also visible inside the app ("Show the prompt used") so the jury can inspect and
compare the exact inputs at demo time. Output length is deliberately capped (1,500 tokens per
call) so answers feel substantial without becoming rambling; the multi-turn chat injects the
anonymized context as JSON and the last 20 messages (context windowing); a regex crisis guard
runs **before** the model and short-circuits unsafe inputs.

**Key prompt, abridged** (full text: `src/js/ai.js`; also viewable in-app via "Show the prompt used"). System: *"Sen 'SÖZÜM SÖZ' dijital iyi olma hâli koçusun… (1) 'bağımlı'/'hasta'/'tedavi' gibi tıbbi veya damgalayıcı sözcükler kullanma, tanı koyma; (4) rakamları yalnızca verilen veriye dayandır; (6) her zaman Türkçe yanıt ver; (7) her çıktının sonuna 'Bu bilgi farkındalık amaçlıdır, tıbbi tanı veya tedavi önerisi değildir.' satırını ekle; (8) kriz sinyali görürsen tanı koymadan Yeşilay 115 ve 112'ye yönlendir; (9) [DOĞRULAMA] kullandığın her sayı veride var mı—emin değilsen rakam uydurma."*

## 4. What We Struggled With (and How We Resolved It)

- **No real user data + privacy.** We have no dataset and cannot collect sensitive logs. Solution:
  self-reported session logs on-device, and a scripted demo mode (1 s ≈ 1 min) that produces a
  realistic week in under two minutes.
- **Making AI meaningful but non-diagnostic.** The first prompts produced moralizing output; we
  iterated until judgment-free language dominated and every reflection stayed anchored to the
  user's own aggregates.
- **Ambiguous outcomes in the core loop.** Overshooting and quick app-switching needed consistent
  consequences — we wired positive reinforcement (+3, streak milestones) and gentle penalties (−5)
  to keep the "promise" meaningful.
- **Safety across both paths.** Crisis handling had to work identically for live model *and*
  template fallback, so we centralized it in one guard.
- **No model training (decision).** We deliberately use foundation models via API; the brief
  grades prompt design, not training, and training on sensitive data would weaken, not improve,
  our ethical case. Fine-tuning for a warmer Turkish coaching tone is documented as future work.

## 5. Ethical Evaluation

| Risk identified | Mitigation implemented in the prototype |
| --- | --- |
| Overconfident / fabricated statistics | Model may only cite numbers present in the aggregated data; every output ends with "informational, not medical advice". |
| Judgment or stigma towards vulnerable users | System rules ban clinical labels and blame; outputs follow "pattern → trigger → experiment"; tested with provocative inputs. |
| Privacy & sensitive data | KVKK m.10 full disclosure + explicit consent is shown only inside the phone when the SÖZÜM SÖZ app icon is tapped (first time): the app is locked until accepted, and rejecting keeps it unusable. In-app data-rights panel (Settings): export own data as JSON (KVKK m.11 access), permanently erase all data including consent + lock app (m.11 erasure, re-asks consent next open), and revoke consent anytime (KVKK m.7). Data stays in browser `localStorage`; only anonymized aggregates ever reach the API; no name/photo/contact is collected. |
| Crisis / self-harm content | Regex guard + model rule redirect to Yeşilay 115 and 112 without diagnosis, in both live and offline paths. |
| Misleading AI-personhood | Every generated item is stamped "Produced by AI" and chat messages carry a YZ (AI) badge. |
| Bias from profiling | No demographic collection; personalization is limited to the user's own behavior over the last 7 days. |

## Demo (≈5 min walkthrough)

Open the phone → "promise" 5 minutes on a social app → timer expires, AI coach notification with a
microbreak (+5) → finish (+3, streak) → run the daily AI reflection → open a chat message with a
crisis phrase to show the 115/112 guard → present the KVKK privacy screen and data-wipe. Full
step-by-step: `docs/DEMO-SCRIPT.md`.