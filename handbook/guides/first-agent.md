# Ship your first governed agent

Go from empty org to a live hosted session through the Agent Gateway.

## Preconditions

- Local stack from [Getting Started](../overview/getting-started.md)
- Two browsers (or profiles): **owner** and **approver**

## 1. Create

As `owner@example.com`:

1. Open **Agents** → create agent (name + slug).
2. Edit the draft: purpose, instructions, runtime (`local` for laptop demos).
3. Save draft.

## 2. Submit

Click **Submit for review**. That freezes intent as an approval request. The owner should not approve their own work when SoD is enabled.

## 3. Approve

As `approver@example.com`:

1. Open **Reviews**.
2. Approve the request.

The system creates an **immutable version** and enqueues a **provision** job.

## 4. Wait for provision

The worker creates a deployment via the runtime adapter. In development with `local`, this is near-instant. With `claude`, wait until the deployment status is `ready`.

> [!TIP]
> Tail the worker: if provision fails, the error is intentional — Agent Studio fails closed rather than inventing a silent fallback.

## 5. Publish hosted web

1. Create an **Application** from the approved agent (Application Studio template).
2. Publish channel `hosted_web`.
3. Open the hosted path on the agent-web-runtime.

## 6. Verify the gateway path

Start a session from the hosted app. Traffic must hit `/api` gateway routes — not the provider directly. You should see usage/audit trails for the org.

## Done when

- [ ] Version status is approved
- [ ] Deployment status is `ready`
- [ ] Hosted app streams a response
- [ ] Audit/usage records exist for the session

Next: [Publish to embed and API](publish-channels.md).
