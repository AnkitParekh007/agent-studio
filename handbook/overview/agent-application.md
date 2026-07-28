# What Is an Agent Application?

In Agent Studio, an **agent** is not a chat window. It is a governed identity with immutable versions. An **application** is how that identity shows up in the world — branded, published, and constrained.

## The factory metaphor

```text
Draft config  →  Submit  →  Approve  →  Provision  →  Publish  →  Serve sessions
     │              │          │           │            │              │
  builder UI     approval   version     runtime      channel      Agent Gateway
                              record     adapter
```

1. **Define** — instructions, model, tools, budgets, knowledge pointers.
2. **Govern** — approval request, SoD, audit event, immutable version.
3. **Provision** — worker asks a runtime adapter (Claude / local) for a deployment.
4. **Publish** — bind that version to hosted web, embed, API, and/or desktop.
5. **Serve** — end users talk only to the Agent Gateway, never to provider keys.

## Objects you will meet

| Object | Role |
| --- | --- |
| Agent definition | Named identity inside an organization |
| Agent version | Immutable snapshot of config |
| Approval request / decision | Human gate with SoD |
| Deployment | Runtime environment for an approved version |
| Application | Product shell (branding, template, slug) |
| Publication | Channel-specific release (`hosted_web`, `embed`, `api`, `desktop`) |
| Publication token | Runtime credential for embed/API (`pub_…`) — not a login |

## Why “application” matters for AI

Shipping a raw agent chat to customers skips product concerns: origin allowlists, CSP `frame-ancestors`, postMessage token delivery, channel-scoped AuthZ, and spend enforcement. Agent Studio makes those **publication properties**, not after-the-fact middleware hacks.

> [!TIP]
> Think of Claude (or any future adapter) as the **engine room**. Agent Studio is the **ship**: bridge (control plane), cargo rules (governance), and hatches (publish channels).
