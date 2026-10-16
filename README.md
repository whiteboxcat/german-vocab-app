# der die das

A WaniKani-style app for German vocabulary from A1 to B2: articles and plurals of nouns,
and meanings, past forms (Präteritum, Perfekt with haben/sein) and separable prefixes of verbs.
Built with Expo, so the same code runs on the web, Android and iOS.

Words come from [german-vocab-data](https://github.com/whiteboxcat/german-vocab-data)
(source: [verbformen.de](https://www.verbformen.de/), CC BY-SA 4.0).

## How learning works

- **Levels.** Words are taught most common first, 10 per level. The next level opens once 8 words
  of the current ones are learned well.
- **Lessons.** 5 new words at a time: read each word, then a short quiz.
- **Reviews.** Each word is drilled on separate parts:
  - nouns: der / die / das, plural, meaning
  - verbs: meaning, Präteritum (*er rief an*), Perfekt (*er hat angerufen*, which checks haben vs. sein)
- **Spacing.** After a lesson, reviews come after 4 hours, 8 hours and 1 day. After that the
  FSRS algorithm schedules each part just before you'd forget it (days, then weeks, then months).
  A word counts as learned once all its parts have passed those first steps.
- **Typing.** ä ö ü ß keys are on screen, and *ae, oe, ue, ss* are accepted too.

**Nouns, verbs or both.** On first open the app asks what to learn (default: both, recommended).
It can be changed anytime from the home screen. The type you don't pick is paused: its lessons and
reviews stop, its progress is kept, and levels unlock by the chosen type only. Switching a paused
type back on brings its overdue reviews back at up to 50 a day.

Progress is saved on the device for now (browser storage on the web). There are no accounts yet:
each browser is its own learner, so a private/incognito window works as a fresh test learner.

## Testing

Open the app with **`?test`** at the end of the link
(https://whiteboxcat.github.io/german-vocab-app/?test). A test panel appears on the home screen:

- **Skip 4 hours / 1 day / 1 week** moves your schedule forward as if that time had passed, so the
  next reviews become due straight away.
- **All reviews due now** brings every learned card up for review.
- **Open next level** opens the next CEFR level without finishing the current one.
- It also shows how many words are loaded, from where (Supabase, GitHub or the saved copy) and the
  data version.

Test mode stays on in that browser until you press **Leave test mode** or open the link with `?test=off`.

## Data source

`src/config.ts`: with a Supabase publishable key the app reads from Supabase; without one it reads the
same JSON files from the public data repository. The word list is cached on the device and only
downloaded again when its `data_version` changes.

## Develop

```bash
npm install
npm test          # learning engine tests
npm run web       # open in the browser
```

Every push to `main` builds the web app and publishes it to GitHub Pages
(Settings → Pages → Source: GitHub Actions).
