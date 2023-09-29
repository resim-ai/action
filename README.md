# action

Interact with ReSim from GitHub Actions

## Usage

### Prerequisites

- ReSim client ID and secret configured as secrets in the repository

### Create Batch

Given an existing build and experience you want to run, use the following to launch a batch:

```yaml
      - name: Create Batch in ReSim
        uses: resim-ai/action@main
        with:          
          client_id: ${{ secrets.RESIM_CLIENT_ID }}
          client_secret: ${{ secrets.RESIM_CLIENT_SECRET }}
          # If you'd like the action to be able to comment on a PR, also provide the automatically generated GitHub token
          github_token: ${{ secrets.GITHUB_TOKEN }}
          resource: batch
          operation: create
          build: 2815ed32-f225-4a92-b8d5-592807a8c475
          # Comma-separated list of experiences
          experiences: 449d52fc-a328-46b5-800b-1e1f771525fa,34a7fc66-cfae-4af1-a8ba-f0355f64c8aa
```

Note that the secrets have to be passed in explicitly (see GitHub [documentation](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions#using-secrets-in-a-workflow))

## Development

### Dependencies

- nodenv
- @vercel/ncc

### Build

Includes formatting, linting and tests

```sh
npm run all
```

### Test

```sh
npm test
```
