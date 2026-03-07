# explain-my-error

![explain-my-error CLI screenshot](./cli-screenshot.svg)

Turn confusing programming errors into clear fixes directly in your terminal.

`explain-my-error` returns:

- A plain-English explanation
- Common root causes
- Likely root cause based on context
- 2-3 alternative hypotheses with confidence
- Ranked fix plans (fast patch / proper fix / long-term fix)
- Framework-specific recipes (React/Next.js/Node/Express/TypeScript)
- Copy-paste remediation commands
- Verify checklist
- A practical fix
- A code example
- An ELI5 summary

Alias included: `eme`

## Install

Install in a project:

```bash
npm i explain-my-error
```

Install globally (recommended for CLI usage from anywhere):

```bash
npm i -g explain-my-error
```

Then run:

```bash
explain-my-error --help
# or
eme --help
```

## Set your API key

Required: `GROQ_API_KEY`

If the key is missing, the CLI will prompt for it interactively and can save it to a local `.env` file.

macOS/Linux (zsh/bash):

```bash
export GROQ_API_KEY="your_groq_api_key"
```

Windows PowerShell:

```powershell
$env:GROQ_API_KEY="your_groq_api_key"
```

### Global install note

If you installed globally with `npm i -g explain-my-error`:

- Interactive key setup saves `.env` in your current working directory.
- For using the CLI from any folder, set `GROQ_API_KEY` in your shell profile.

Persist on macOS/Linux:

```bash
echo 'export GROQ_API_KEY="your_groq_api_key"' >> ~/.zshrc
source ~/.zshrc
```

## Usage

### Interactive mode

```bash
explain-my-error
```

```bash
eme
```

### Inline message

```bash
explain-my-error explain "TypeError: Cannot read property 'map' of undefined"
```

```bash
eme explain "ReferenceError: x is not defined"
```

### Context-aware input

```bash
eme explain "TypeError: Cannot read property 'map' of undefined" \
  --framework react \
  --runtime "node 20" \
  --stack "at App (src/App.tsx:12:5)" \
  --code "items.map(item => item.id)"
```

```bash
eme explain --stack-file ./error.log --code-file ./src/App.tsx --framework nextjs
```

### JSON mode

```bash
eme explain "ReferenceError: x is not defined" --json
```

### Piped input

```bash
cat error.txt | explain-my-error
```

```bash
npm run build 2>&1 | eme
```

## Command reference

```bash
explain-my-error [command]
```

Commands:

- `explain [error...]` Explain a programming error
- `--json` Return structured JSON output
- `--stack`, `--stack-file` Add stack trace context
- `--code`, `--code-file` Add code snippet context
- `--runtime` Add runtime context
- `--framework` Add framework context
- `--help` Show CLI help
- `--version` Show CLI version


## Example output

```text
========================================================================
| EXPLAIN MY ERROR                                                     |
| AI powered debugging for humans                                      |
========================================================================

ERROR: TypeError: Cannot read property 'map' of undefined

------------------------------------------------------------------------
EXPLANATION
This happens when .map() is called on a variable that is undefined.
------------------------------------------------------------------------

------------------------------------------------------------------------
COMMON CAUSES
1. API data not loaded
2. State not initialized
3. Incorrect variable reference
------------------------------------------------------------------------

FIX
Ensure the array exists before calling map.

------------------------------------------------------------------------
CODE EXAMPLE
const items = data?.items ?? [];
items.map(...)
------------------------------------------------------------------------

------------------------------------------------------------------------
ELI5
Your code expected a box of toys (an array), but the toy box was empty.
------------------------------------------------------------------------
```

## Open Agent Skill

- Skill spec: `skills/SKILL.md`
- Skill function: `runExplainErrorSkill(input)`
