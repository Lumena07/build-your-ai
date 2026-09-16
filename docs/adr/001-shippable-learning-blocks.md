# ADR-001: Extract AI 102 into dependency-free learning blocks

**Status:** Accepted
**Date:** 2026-09-16
**Deciders:** AI 102 product owner

## Context

Eve, the lesson progression and the warm-classroom interface should be reusable in another learning product. Copying the full AI 102 application would also copy its mission content, storage shape, authentication and deployment assumptions.

## Decision

Keep AI 102 as the host application and extract three framework-neutral JavaScript blocks: Eve teacher, learning journey and classroom UI. Each exposes a small public API and has no external runtime dependency. AI 102 itself consumes those APIs so portability is continuously exercised.

## Options considered

### Copy the whole application

Low initial effort, but high coupling and repeated bugs when two copies change independently.

### Publish a large framework package

Strong encapsulation, but it introduces a build framework and migration cost that the current plain-browser application does not need.

### Small dependency-free blocks

Moderate extraction work, low adoption cost and clear ownership boundaries. This fits the current application and can later be wrapped for React, Vue or another framework.

## Consequences

- Another system can reuse one block or all three.
- Course content, model provider and storage remain replaceable.
- Public contracts require versioning and tests.
- More complex products may later need adapters for their framework and data store.

## Action items

1. Keep AI 102 tests exercising the integrated blocks.
2. Build a clean distribution with `npm run blocks:build`.
3. Introduce a breaking major version if a public function contract changes.
