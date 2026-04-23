# Appwrite Function Deployment Notes

## Current Repo State

This repository currently has an Appwrite Site deployment connected through Appwrite/Git, but it does not contain
Appwrite Function source folders or function entries in `appwrite.config.json`.

Until functions are pulled or initialized into the repository, there is nothing for the repo to deploy as an Appwrite
Function.

## What Appwrite Supports

Official references:

- Webhooks: https://appwrite.io/docs/advanced/platform/webhooks
- Functions CLI: https://appwrite.io/docs/tooling/command-line/functions
- Git-connected Functions: https://appwrite.io/docs/products/functions/quick-start

Appwrite webhooks subscribe to Appwrite resource events such as `functions.*`, `functions.*.deployments.*`,
`tablesdb.*`, and storage events. They do not watch Git branch file changes.

For branch-based function code deployment, use one of these paths:

1. Connect the Appwrite Function to Git in the Appwrite Console. Appwrite can deploy function code on pushes to the
   configured repository branch.
2. Store function source and metadata in the repo with `appwrite pull functions`, then run:

```bash
npm run deploy:appwrite-functions
```

The script is intentionally a no-op until `appwrite.config.json` contains a `functions` array.

## Implementation Rule

Do not add a webhook that tries to deploy functions from Appwrite function events. That is circular: those events fire
after a function or deployment changes inside Appwrite. GitHub push events or Appwrite Git-connected Functions are the
right trigger for branch code changes.
