# explain_error

## Metadata

```yaml
name: explain_error
description: Explains programming errors and provides fixes.
```

- Name: `explain_error`
- Description: `Explains programming errors and provides fixes.`

## Description

This skill takes a raw programming error string and returns a structured explanation that is easy for both humans and agents to consume.

## Input schema

```json
{
  "type": "object",
  "properties": {
    "error": {
      "type": "string",
      "description": "Programming error message"
    }
  },
  "required": ["error"]
}
```

## Output schema

```json
{
  "type": "object",
  "properties": {
    "title": { "type": "string" },
    "explanation": { "type": "string" },
    "common_causes": {
      "type": "array",
      "items": { "type": "string" }
    },
    "fix": { "type": "string" },
    "code_example": { "type": "string" },
    "eli5": { "type": "string" }
  }
}
```

## Implementation

- Runtime entrypoint: `src/skills/explainError.skill.ts`
- Exported function: `runExplainErrorSkill(input)`

## Example input

```json
{
  "error": "TypeError: Cannot read property 'map' of undefined"
}
```

## Example output

```json
{
  "title": "TypeError: Cannot read property 'map' of undefined",
  "explanation": "This happens when .map() is called on a variable that is undefined.",
  "common_causes": [
    "API data not loaded",
    "State not initialized",
    "Incorrect variable reference"
  ],
  "fix": "Ensure the array exists before calling map.",
  "code_example": "const items = data?.items ?? [];\\nitems.map(...)",
  "eli5": "Your code expected a box of toys (an array), but the toy box was empty."
}
```
