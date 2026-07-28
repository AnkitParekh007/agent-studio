# Define once

An agent in Agent Studio is a **single governed identity**. You do not fork prompts per channel.

## Draft → version

- Builders edit a **draft** configuration (instructions, model, runtime provider, tools, budgets).
- Submit creates an approval request.
- Approval produces an **immutable version**. History is a chain of versions, not silent overwrites.

## Why agents need immutability

AI behavior is software. If production embeds pin “whatever is in the editor,” you cannot answer:

- What instructions ran during last Tuesday’s incident?
- Which tool allowlist was active when spend spiked?
- Can we roll back without editing a live prompt?

Versions + publications answer those questions with records, not folklore.

## Related

- [Govern centrally](governance.md)
- [Domain model](../developing/domain-model.md)
