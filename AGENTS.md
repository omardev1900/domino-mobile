# 🎯 Domino Martiniquais — Instructions IA (Master)

> Fichier chargé automatiquement à chaque session. Max 150 lignes.
> Détails complets dans `docs/`.

---

## 📚 Fichiers de référence

- **Brief projet** → @README.md
- **Structure de la doc** → @docs/STRUCTURE.md *(à lire une fois, pour comprendre l'organisation)*
- **Tâches actives** → @docs/pilotage/TASKS.md
- **Backlog** → @docs/pilotage/BACKLOG.md
- **Archive** → @docs/pilotage/DONE.md
- **Retours client** → @docs/feedback/CLIENT.md
- **Changelog** → @docs/feedback/CHANGELOG.md
- **Architecture** → @docs/specs/ARCHITECTURE.md
- **Règles du jeu** → @docs/specs/GAME_RULES.md
- **Roadmap** → @docs/ROADMAP.md

---

## 🔄 Workflow des tâches (OBLIGATOIRE)

```
BACKLOG.md  →  TASKS.md  →  DONE.md
 (à faire)     (en cours)    (archive)
```

- Nouvelle demande → ajoutée à `BACKLOG.md`
- Décision de traiter → déplacée vers `TASKS.md`
- Tâche terminée → déplacée vers `DONE.md` sous la date du jour (`### AAAA-MM-JJ`)

Les retours client bruts vont **d'abord** dans `feedback/CLIENT.md` (verbatim, daté), puis reformulés dans `BACKLOG.md`.

---

## ✍️ 5 Commandes verbales standards

| Commande | Action |
|---|---|
| `Ajoute au backlog : <description>` | 1 ligne ajoutée dans `BACKLOG.md` sous la bonne section |
| `Démarre <ID>` | Déplace l'entrée `BACKLOG.md` → `TASKS.md`, lit la spec si existe, propose un plan avant de coder |
| `Livre <ID>` | Coche dans `TASKS.md`, déplace vers `DONE.md` sous la date du jour, ajoute au `CHANGELOG.md` si user-facing |
| `Où en est-on ?` | Résumé en 3 lignes : actif / livré cette semaine / prochaine priorité |
| `Nouveau retour client : "<citation>"` | Append verbatim à `feedback/CLIENT.md` + entrée liée dans `BACKLOG.md` |

---

## 🏗️ Règles absolues — Architecture

**Flux obligatoire pour toute action de jeu :**
```
GameScreen → useGameEngine → useActionDispatcher → LogicEngine.ts
```

- Toute nouvelle logique métier → `LogicEngine.ts` (fonctions pures, testables)
- Toute nouvelle logique de scoring → `ScoringEngine.ts`
- Logs uniquement via `LogService` — jamais de `console.*` direct
- Écriture Firestore uniquement dans `try/finally` atomique
- Ne pas restructurer les fichiers critiques sans discussion *(voir liste dans `docs/specs/ARCHITECTURE.md`)*

---

## 🚫 Ne jamais faire

- Pas de `any` TypeScript sans justification
- Pas de mutation d'état hors `useActionDispatcher`
- Pas de clés secrètes dans le code — toujours dans `.env`
- Ne pas réintroduire le mode invité (supprimé définitivement)
- Ne pas réimplémenter : système d'amis, graphismes 3D, chat texte libre, cash-prize tournois

## 🔨 Build Android — règle absolue

**Ce projet ne passe PAS par les serveurs EAS / Expo Application Services.**

- ❌ `eas build` — interdit
- ❌ `eas env:create` / `eas secret:create` — interdit
- ❌ Toute commande `eas` qui contacte les serveurs Expo — interdite
- ✅ Build local uniquement : `cd mobile/android && ./gradlew bundleRelease` (AAB) ou `./gradlew assembleRelease` (APK)
- ✅ Les variables d'environnement sont dans `mobile/.env` (gitignored, jamais dans `eas.json`)

---

## 🛠️ Conventions de code

- TypeScript strict + validation inputs via Zod
- Tests obligatoires pour toute logique dans `LogicEngine`
- `structuredClone` — jamais `JSON.parse(JSON.stringify())`
- **Règle de découpage** : Ne JAMAIS créer de fichiers volumineux (ex: > 400 lignes). Privilégier systématiquement des petits fichiers facilement maintenables (composants purs, custom hooks dédiés).
- Nouveaux composants : reproduire le pattern de `src/features/auth/`
- Nouvelles features : suivre le pattern des Custom Hooks (`useGameEngine`, etc.)

---

## 📝 Instructions de Session (Tous Agents)

**En début de session :**
1. Consulter `docs/pilotage/TASKS.md` pour voir les tâches actives
2. Si vide → proposer à l'utilisateur de piocher dans `docs/pilotage/BACKLOG.md`

**En fin de tâche :**
1. Cocher la case dans `TASKS.md`
2. Déplacer l'entrée vers `DONE.md` sous la date du jour
3. Si visible côté user → ajouter au `CHANGELOG.md`
4. Retirer tout ticket ou sous-ticket `Fait` restant de `TASKS.md`

**Règle de clôture documentaire :**
Une tâche n'est pas terminée tant que `TASKS.md`, `DONE.md` et, si nécessaire, `CHANGELOG.md` ne sont pas tous synchronisés.
`TASKS.md` ne doit contenir que du réellement ouvert : `Prêt`, `En cours`, `Différé`.

**Jamais modifier** un feedback client archivé dans `docs/feedback/CLIENT.md`.


### Lesson Learned (2026-04-30) - Antigravity Agent Failed On Git worktreeConfig Extension

**What went wrong**: Antigravity Agent did not start even after standard Git checks looked healthy. The Antigravity language-server log showed `core.repositoryformatversion does not support extension: worktreeconfig`, followed by `workspace infos is nil`.

**Why it happened**: Shared IDE-agent usage left the repo in a Git shape Antigravity could not parse: `extensions.worktreeConfig=true` remained in `.git/config`, multiple Codex/Claude/Kilo worktrees were registered, some generated worktree paths had been tracked as `160000` gitlinks without matching `.gitmodules` entries, and the local Git metadata also contained a stale commit-graph plus a stale remote-tracking reflog reference. Plain `git status` and later `git fsck` could pass before Antigravity was actually compatible.

**Correct approach**: Diagnose Antigravity startup from its own logs first, then repair Git metadata in layers: quarantine generated commit-graph caches instead of deleting source files, expire stale reflog references only after identifying the offending ref, remove malformed generated-worktree gitlinks from the index or add real `.gitmodules` mappings, verify `git submodule status --recursive`, and finally unset `extensions.worktreeConfig` only after inspecting `.git/worktrees/*/config.worktree` for settings that need preservation.

**How to avoid**: Do not put generated agent worktrees under tracked repo paths, and keep `.claude/worktrees/`, `.kilo/worktrees/`, and similar agent worktree roots locally excluded. When Antigravity fails to start, check the newest Antigravity `ls-main.log` for `worktreeconfig`, `workspace infos is nil`, or Git parser errors; do not stop at `git status`. Before enabling Git worktree extensions in this repo, confirm Antigravity supports them or keep Antigravity on a repo clone that does not use per-worktree Git config.

### Lesson Learned (2026-05-04) - Prefer VS Code ignoredRepositories For Source Control Worktree Clutter

**What went wrong**: After repairing the Antigravity `worktreeConfig` failure, VS Code Source Control still listed many clean assistant worktrees from Codex, Claude, and Kilo roots. The visible symptom looked like repo dirt, but most entries were registered Git worktrees with zero uncommitted changes, not tracked files in the main worktree.

**Why it happened**: Git still had multiple registered detached worktrees under external assistant roots, so VS Code discovered and displayed each one as a repository. A broad `git worktree remove --force` would have made the UI quiet, but it would also delete those worktree directories and risk discarding detached assistant state.

**Correct approach**: First separate three cases: malformed `160000` gitlinks in the main index, registered clean worktrees in `.git/worktrees`, and actual dirty user work. Remove malformed generated-worktree gitlinks from the index when needed, but for Source Control clutter prefer a non-destructive `.vscode/settings.json` `git.ignoredRepositories` list for known generated worktree paths. Reload VS Code or Antigravity after changing the setting.

**How to avoid**: Do not use destructive worktree cleanup just to fix SCM visibility. Before deleting any worktree directory, run `git worktree list --porcelain` and per-worktree `git status --short`; if the issue is only Source Control noise, hide the generated worktree repositories in editor settings instead.
