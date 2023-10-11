# action

Interact with ReSim from GitHub Actions

## Usage

### Prerequisites

- ReSim client ID and secret configured as secrets in the repository
- ECR registry URL (e.g. `123456789.dkr.ecr.us-east-1.amazonaws.com`) as a variable
- Experiences configured and tagged in ReSim

### Launch Batch with existing image

If you want to launch batches in ReSim from a separate workflow, or just want to add a ReSim step to an existing workflow, you need a step like this:

```yaml
      - name: Launch Batch in ReSim
        uses: resim-ai/action@v1
        with:          
          client_id: ${{ secrets.RESIM_CLIENT_ID }}
          client_secret: ${{ secrets.RESIM_CLIENT_SECRET }}
          experience_tags: experiences-a,experiences-b
          image: ${{ steps.build_image.outputs.tags }}
```

- `experience_tags` should be set to the tag (or comma-separated tags) of the experiences you want to run. This could be a variable based on whether the workflow is running on a trunk branch or in a pull request.
- `image` should be set to an image URI, where the image tag reflects the version of your software you'd like to test.
- The secrets used for authentication have to be passed in explicitly (see GitHub [documentation](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions#using-secrets-in-a-workflow))

### Full example

If you have a repository with your code and a Dockerfile but no GitHub workflows, the below example can be adapted to get GitHub Actions to build your software and image and test it using ReSim. 

```yaml
name: build-and-test
on:
  pull_request:

jobs:
  build_and_test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3

      - name: Build
        run: bazel build

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Prepare Docker metadata
        id: docker_meta
        uses: docker/metadata-action@v5
        with:
          images: |
            ${{ vars.ECR_REGISTRY_URL }}/my-image
          tags: |
            type=sha

      - name: Build and push image
        id: docker_build
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          push: true
          tags: ${{ steps.docker_meta.outputs.tags }}

      - name: Launch Batch in ReSim
        uses: resim-ai/action@v1
        with:          
          client_id: ${{ secrets.RESIM_CLIENT_ID }}
          client_secret: ${{ secrets.RESIM_CLIENT_SECRET }}
          experience_tags: our-blocking-experiences
          image: ${{ steps.docker_meta.outputs.tags }}
```

## Development

### Build

Includes formatting, linting and tests

```sh
npm run all
```

### Regenerate the client

```sh
npm run generate
```

### Test

```sh
npm test
```
