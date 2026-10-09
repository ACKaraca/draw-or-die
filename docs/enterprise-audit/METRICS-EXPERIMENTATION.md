# Metrics and Experimentation

## Measurement objective

Measure whether a user improves the same project safely and sustainably. Do not optimize generated critique count,
issued Rapido, sign-ups, or pageviews as company outcomes.

## North-star metric

**Weekly Jury-Ready Iterations**: unique projects owned by verified users where, within seven days:

1. a critique is completed;
2. at least one action is selected;
3. a later artifact version is submitted; and
4. a revision comparison is completed.

Count each project once per rolling seven-day window. Keep the component events visible so metric movement can be
diagnosed. Do not retroactively change the definition without versioning and backfill notes.

## Metric tree

| Layer | Metric | Guardrail |
|---|---|---|
| Acquisition | Qualified landing → Studio opened | Consent and page performance |
| Activation | Verified user completes critique and selects action | AI accepted-output and failure rate |
| Retention | D7 revision completion; W4 repeated loop | Notification opt-out/complaint |
| Product value | Resolved issue share; user usefulness | Dismiss/challenge and correction rate |
| Revenue | Paid conversion and contribution margin | Refund, dispute, support, churn |
| Growth | Share/referral recipient activation | Unauthorized publication and fraud |
| Team | Activated private team revision loops | Cross-team access, wrong-wallet charge, support burden |
| Reliability | Successful critical journey and latency | Error-budget burn |
| B2B | Learner loops and educator usefulness | Privacy incident and intervention burden |

AI “quality,” progression score, or self-reported helpfulness must not be treated as learning outcome proof.

## Event contract

Every event uses a versioned allowlist. Conceptual envelope:

```ts
type ProductEvent = {
  eventId: string;
  eventName: EventName;
  eventVersion: number;
  occurredAt: string;
  receivedAt: string;
  anonymousId: string;
  userId?: string;
  projectId?: string;
  sessionId: string;
  route: string;
  locale: string;
  accountKind: 'visitor' | 'guest' | 'unverified' | 'verified' | 'premium';
  operation?: string;
  experimentAssignments?: Array<{ experiment: string; variant: string }>;
  attribution?: Attribution;
  properties: Record<string, string | number | boolean | null>;
};
```

Generate idempotent server event IDs for purchases, refunds, wallet mutations, critique completion, and revision
completion. Client intent and server outcome are different events.

## Standard and domain events

Use GA-recommended names where semantics match: `sign_up`, `login`, `begin_checkout`, `purchase`, `refund`, `share`,
`generate_lead`, `join_group`, `earn_virtual_currency`, and `spend_virtual_currency`.

Domain sequence:

- `landing_viewed`
- `studio_opened`
- `upload_started`, `upload_validated`, `upload_failed`
- `auth_started`, `guest_created`, `account_conversion_completed`, `sign_up`
- `critique_started`, `critique_completed`, `critique_failed`, `critique_cancelled`
- `result_viewed`
- `action_selected`, `action_changed`
- `revision_started`, `revision_completed`, `revision_failed`
- `paywall_viewed`, `begin_checkout`, `purchase`, `refund`
- `mentor_started`, `defense_started`
- `publish_consent_viewed`, `publish_consent_granted`, `share`, `publication_revoked`
- `peer_review_opened`, `peer_review_submitted`, `peer_review_accepted`
- `referral_link_created`, `referral_landed`, `referral_activated`, `referral_rewarded`
- `team_created`, `team_invite_sent`, `team_member_joined`, `team_member_removed`
- `team_project_shared`, `team_project_unshared`, `team_analysis_completed`, `team_revision_completed`
- `team_pool_funded`, `team_pool_reserved`, `team_pool_settled`, `team_pool_voided`
- `education_lead_submitted`, `pilot_started`, `pilot_completed`, `pilot_renewed`

The existing conversion endpoint must not return success unless a valid event is durably accepted or a clear
idempotent duplicate is recognized.

## Data minimization

Never put these in analytics or ad platforms:

- email, full name, phone, address, or education mailbox;
- filename, artifact URL, image/PDF bytes, labels, extracted PDF text;
- prompt, critique, mentor/defense chat, or user reflection;
- Stripe customer/session/subscription identifiers in client analytics;
- raw IP, exact location, auth token, verification code, or secret;
- sensitive error stack or internal moderation content.

Use bounded enumerations for tier, operation, result class, error code, route, locale, and experiment. Maintain schema
ownership, retention, consent purpose, and downstream destination for every field.

## Attribution

Capture permitted first and last touch at landing, bind to the durable account during conversion, and include a safe
attribution ID—not arbitrary client metadata—in Checkout. Join server-side purchase/refund events to the attribution
record. Preserve organic/direct/unknown honestly.

Required dimensions:

- source, medium, campaign, term/content when allowed;
- landing route and referrer class;
- campus/event/ambassador/referral IDs;
- first-touch and last-touch timestamps;
- consent state and schema version.

Do not let UTM values change price, entitlement, or reward eligibility. Sanitize and length-limit all campaign input.

## Data-quality gates

Before using the funnel for spend decisions:

- synthetic consented event flow delivers at least 95% end to end;
- duplicate rate is below 1%;
- server purchases/refunds reconcile daily 100% to Stripe source events;
- event timestamps and identities survive guest conversion without double counting;
- production and development data are separated;
- route pageviews work through client and server navigation;
- event schema rejection and PII tests pass;
- decision reports expose freshness and completeness.

The percentage values are initial operating gates, not current performance claims.

## Required internal decision reports

These are scheduled, access-controlled reports and alert queries, not a user-facing dashboard feature.

### Product decision report

- weekly jury-ready iterations and unique verified users;
- critique → action → revision funnel by cohort/tier/operation;
- D7/W4 loop retention;
- paid conversion, churn, refund, and contribution margin;
- trust and reliability guardrails.

### AI and operations report

- accepted output, schema failure, timeout, retry, fallback, and latency by operation/model/version;
- provider cost and Rapido settlement by operation;
- user usefulness/dismiss/challenge/correction;
- wallet, Stripe, entitlement, event, and storage reconciliation drift.

### Growth report

- qualified activation by first/last touch;
- activated CAC and modeled payback by channel;
- share/referral/campus loop quality and reward cost;
- SEO query/page → Studio activation, not traffic alone.

### Friends Team report

- created → invited → joined → first shared project → first team analysis → team revision;
- active members and team revision loops without exposing member/project content;
- shared-pool funding, utilization, void/refund/expiry, and wrong-wallet/drift invariants;
- support, invite abuse, removal/access denial, cancellation, and contribution margin by approved package.

### Education pilot report

- roster activation, critique and revision distributions;
- educator usefulness and intervention signal;
- support burden, privacy/safety incident, and renewal reason;
- cohort allowance utilization/reconciliation and contract-level contribution evidence;
- cross-pilot denial, wrong-wallet, overage, export/delete, and restore invariants;
- minimum cohort-size suppression to avoid exposing individual learners.

## Experiment protocol

Every experiment record must include:

1. problem and user segment;
2. falsifiable hypothesis;
3. one primary metric and named guardrails;
4. eligibility, exclusion, assignment unit, and exposure event;
5. baseline window and data-quality proof;
6. intended duration and sample/power approach;
7. maximum financial/data exposure and kill conditions;
8. implementation and rollback owner;
9. analysis plan before results;
10. ship, iterate, stop, or inconclusive decision with rationale.

Do not run overlapping tests on the same user journey without interaction planning. Do not repeatedly peek and stop on a
favorable result. If volume is too low for conventional significance, use sequential qualitative/quantitative evidence
and state uncertainty rather than manufacturing certainty.

## Experiment priority order

1. Event and identity correctness—an A/A or synthetic validation, not a growth test.
2. Guided first analysis versus blocking tutorial.
3. Revision-first result hierarchy.
4. History resume and project lineage.
5. Monthly premium versus Jury Week message/packaging.
6. Permissioned share artifact.
7. Activation-qualified referral reward.
8. Campus event and creator channels.
9. Portfolio Season.
10. Friends Team workflow and packaging.
11. Education pilot packaging under its separate school contract.

Paid media is gated on validated contribution margin and a provisional payback target no longer than three months.
This target is a starting financial hypothesis and must be approved against cash flow.

## Guardrail set

Every product or growth experiment monitors:

- unauthorized publication or privacy complaint;
- guest/account conversion loss or duplicate profile;
- AI accepted-output, latency, and correction/dismissal;
- settled charge without output and reconciliation drift;
- cross-team access, removed-member access, or personal/team wrong-wallet charge;
- refund/dispute/support contact;
- accessibility or core-journey failure;
- retention cannibalization;
- provider and support contribution cost.

Stop immediately on a P0 correctness invariant, regardless of conversion lift.

## Source note

Google's recommended event documentation was accessed 2026-08-04:
[Google Analytics recommended events](https://support.google.com/analytics/answer/9267735).
