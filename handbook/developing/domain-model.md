# Domain model

Core nouns the factory orchestrates:

| Entity | Meaning |
| --- | --- |
| Organization | Tenant boundary |
| Membership / role | RBAC binding |
| Agent definition | Named agent identity |
| Agent version | Immutable config snapshot |
| Approval request / decision | Human gate |
| Deployment | Provisioned runtime environment |
| Application definition | Product shell |
| Publication | Channel release |
| Publication token | Runtime credential |
| Runtime session / events | Gateway execution trail |
| Usage / audit | Spend + compliance signals |

State machines for version lifecycle live in `packages/domain`. Persistence is Drizzle in `packages/database`.
