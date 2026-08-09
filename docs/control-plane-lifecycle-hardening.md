# Control Plane Lifecycle Hardening

This change consolidates the strongest lifecycle ideas from the earlier control-plane architecture into Agent Studio's provider-neutral domain instead of copying an older implementation wholesale.

## Immutable approved versions

Runtime sessions must bind to the **current approved version**. `assertRunnableVersion` rejects:

- draft versions
- waiting versions
- rejected versions
- superseded versions
- stale version identifiers even if a caller still believes they are approved
- all versions after agent termination

`approveAndSupersede` approves a waiting version and returns a new immutable version set where any previously approved version becomes `superseded`.

## Provisioning lifecycle

The domain now models:

`queued → running → succeeded | failed | cancelled | superseded`

Failed provisioning can be retried as a new numbered attempt. The idempotency key remains stable for one `agent + version + publication channel` combination, allowing infrastructure workers to deduplicate duplicate dispatches while preserving retry history.

## Callback replay protection

Provisioning callbacks have two enforcement layers:

1. **API edge:** HMAC-SHA256 signature, timestamp freshness window, and unique callback id.
2. **Domain:** idempotency-key match, active attempt number, and active `running` state.

The split is intentional. Node crypto belongs at the API edge; version/provisioning rules remain portable domain policy.

## Publication grants

Hosted, embed, API, and desktop publications should be treated as grants for an exact immutable version. A grant is unusable when:

- explicitly revoked
- superseded by another grant
- bound to an old version
- the agent is terminated
- no current approved version exists

This gives desktop/download authorization and hosted publication paths a common revocation model.

## Test coverage

Domain tests cover:

- approving a waiting version and superseding the prior approved version
- rejection of invalid approval state
- rejection of stale and rejected runtime versions
- stable provisioning idempotency keys
- failed provisioning retry attempt numbering
- invalid provisioning transitions
- stale callback attempt rejection
- current callback acceptance after transport signature verification
- revoked/superseded/terminated publication grants

API tests cover:

- valid signed callback
- modified callback body
- expired callback timestamp
- replayed callback id
- wrong signing secret

## Integration rule

External build/provisioning endpoints should verify the signed callback **before** calling `assertProvisioningCallbackClaim`. Persistence should mark the callback id consumed atomically with the provisioning state transition so concurrent duplicate callbacks cannot both commit.
