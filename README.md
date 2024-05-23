# ReSim.ai GitHub Action

Interact with ReSim from GitHub Actions

- [Usage](#usage)
  - [Prerequisites](#prerequisites)
  - [Launch Batch with existing image](#launch-batch-with-existing-image)
  - [Full example](#full-example)
  - [Inputs](#inputs)
- [Development](#development)
  - [Build](#build)
  - [Regenerate the client](#regenerate-the-client)
  - [Test](#test)

## Usage

### Prerequisites

- ReSim client ID and secret configured as secrets in the repository
- ECR registry URL (e.g. `123456789.dkr.ecr.us-east-1.amazonaws.com`) as a variable
- AWS access key and secret access key with permission to push to the ECR repository.
- Experiences configured and tagged in ReSim

See our documentation for setting up an ECR repository for use with ReSim: https://docs.resim.ai/pushing-build-images-from-ci/introduction

### Run Test Suite with existing image

If you want to run a test suite in ReSim from a separate workflow, or just want to add a ReSim step to an existing workflow, add a step like this:

```yaml
      - name: Launch Batch in ReSim
        uses: resim-ai/action@v1
        with:          
          client_id: ${{ secrets.RESIM_CLIENT_ID }}
          client_secret: ${{ secrets.RESIM_CLIENT_SECRET }}
          test_suite: my-test-suite
          system: my-system
          image: ${{ steps.build_image.outputs.tags }}
```

- `test_suite` should be set to the test suite that you want to run. This could be a variable based on whether the workflow is running on a trunk branch or in a pull request.
- `image` should be set to an image URI, where the image tag reflects the version of your software you'd like to test. The `system` flag will be what is used to register the build
- The secrets used for authentication have to be passed in explicitly (a [GitHub requirement](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions#using-secrets-in-a-workflow))

### Run Ad Hoc Test Batch with existing image

If you do not want to use a test suite, but simply use a fixed set of experiences and metrics build, you can add a step like this:

```yaml
      - name: Launch Batch in ReSim
        uses: resim-ai/action@v1
        with:          
          client_id: ${{ secrets.RESIM_CLIENT_ID }}
          client_secret: ${{ secrets.RESIM_CLIENT_SECRET }}
          system: my-system
          image: ${{ steps.build_image.outputs.tags }}
          experiences: my-experience, my-second-experience
          metrics_build_id: uuid
```

The two methods are mutually exclusive.

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
        run: bazel build # or other build commands as required

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to ECR
        uses: docker/login-action@v2
        with:
          registry: ${{ vars.ECR_REGISTRY_URL }}
          username: ${{ secrets.AWS_ACCESS_KEY_ID }}
          password: ${{ secrets.AWS_SECRET_ACCESS_KEY }}

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
          project: your-resim-project
          system: your-resim-system
          image: ${{ steps.docker_meta.outputs.tags }}
          test_suite: my_test_suite
```

### Inputs

| Name             | Required | Description                                                                                                              |
| ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| client_id        | Yes      | Provided by ReSim, used to authenticate. Should be passed in as a secret.                                                |
| client_secret    | Yes      | Provided by ReSim, used to authenticate. Should be passed in as a secret.                                                |
| project          | Yes      | Name of ReSim project in which to run.                                                                                   |
| system           | Yes      | Name of ReSim system with which to run.                                                                                  |
| image            | Yes      | URI of image that ReSim will pull and test.                                                                              |
| test_suite       | *        | The name of a test suite to run (must not be used in conjunction with experiences, experience_tags, or metrics_build_id) |
| experience_tags  | *        | Comma-separated list of tags - the experiences in these tags will be used in the tests. For example: `vision,planning`   |
| experiences      | *        | Comma-separated list of experience names to run against.                                                                 |
| comment_on_pr    | No       | If `true` and `github_token` is also set, the action will comment on PRs with a link to view results in the ReSim app.   |
| github_token     | No       | If provided, and `comment_on_pr` is `true`, the action will comment on PRs with a link to view results in the ReSim app. |
| metrics_build_id | No       | If set, this metrics build will be run against the batch.                                                                |

 **\* If not using a test suite, at least one of `experiences` or `experience_tags` must be set.** 

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

When testing the action against a development or staging deployment, set `api_endpoint` and `auth0_tenant_url` appropriately.
