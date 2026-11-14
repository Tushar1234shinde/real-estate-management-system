# Mobile recording and operational security decision

## Decision

Retain the web workflow as the browser-safe path: an Outside Sales employee
explicitly verifies current location and uploads evidence through the existing
authenticated, authorized, signature- and size-validated APIs. The UI states
that it is foreground-only and that audio is a manual evidence upload.

Do **not** claim that a website can automatically record in the background,
prevent OS-level screenshots, or continuously block access after a geofence
exit. Those needs require a managed native companion application.

## Browser boundary

| Requirement | Reliable web behavior | Not a web guarantee |
| --- | --- | --- |
| Arrival geofence | The server checks the assigned employee, supplied high-accuracy position, property coordinates, and configured radius before evidence upload. | Continuous background tracking, tamper resistance, or locking access after an exit. Browsers can be suspended, closed, or receive mocked device data. |
| Voice evidence | Employee-selected audio is uploaded through the current validated evidence endpoint. | Automatic start/stop recording, especially when the page is hidden or closed. |
| Screen privacy | Keep secrets out of UI, use HTTPS, role authorization, authenticated media, and short-lived access URLs. | Screenshot, screen-recording, browser-extension, or second-camera prevention. |
| Visibility | The web UI warns when the visit document is hidden. | A visibility event is informational; it cannot keep audio/location services alive or enforce policy. |

Browser `getUserMedia` requires a secure context and user permission; recording
uses a browser-chosen encoding. Neither API makes background scheduling
reliable. See [MDN: getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
and [MDN: MediaStream Recording](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_Recording_API/Using_the_MediaStream_Recording_API).

## Recommended native architecture

Build a React Native companion app with small native modules for device-policy
features. Keep this API as the system of record for visit ownership, state,
media validation, review, and audit.

```text
React Native visit app
  ├─ registered-device auth/session
  ├─ visit coordinator state machine
  ├─ native location/geofence service
  ├─ native audio recorder service
  ├─ encrypted local evidence queue
  ├─ resumable upload worker
  └─ screen-protection adapter
             │ TLS + short-lived device/employee/visit-bound upload authority
             ▼
Existing API ── authorization, visit-state, signature/size checks ── authenticated media storage
             │
             └─ consent, permission, location, recording, upload, and policy audit events
```

### Companion-app controls

1. Obtain explicit recording/location disclosure and permissions at active
   visit start. Capture the consent-version and permission changes as audit
   events; obtain the legal/privacy review required in each operating region.
2. Begin a signed mobile visit session only after existing assignment and
   arrival checks. Start location and audio services for that session, and stop
   on completion, cancellation, permission loss, timeout, server revocation,
   or confirmed geofence exit.
3. Use native background location only for the active visit. Send timestamp,
   accuracy, and source metadata; allow a policy-approved grace period for GPS
   drift. On confirmed exit, pause/stop recording, lock only visit actions,
   audit `GEOFENCE_EXIT`, and require server-authorized re-entry. The server,
   not the client, owns state transitions.
4. Android: run visible foreground services started while the activity is
   visible, with microphone/location types and their runtime permissions.
   Android restricts starting microphone/location services from background.
   iOS: use approved background audio/location capabilities, disclose them,
   and handle OS suspension/termination and audio interruptions safely.
5. Encrypt each queued recording with AES-GCM and a per-file data key; wrap
   keys with Android Keystore or iOS Keychain hardware-backed protection when
   available. Keep only opaque IDs, encrypted metadata, hash, and upload state
   locally. Never store media bytes, access tokens, or refresh tokens in
   AsyncStorage. Delete local encrypted copies only after acknowledged,
   integrity-checked upload.
6. Upload through a short-lived authorization bound to device, employee, visit,
   media type, expected digest, and expiry. Use TLS and resumable,
   idempotent chunks. Preserve existing server authorization and file
   signature/size validation; a queued upload must not bypass a revoked
   assignment or changed visit state.
7. Android sensitive screens use `FLAG_SECURE` and redacted recents previews.
   It helps block ordinary screenshots/casting on supported surfaces but does
   not defeat compromised devices or a second camera. iOS supplies a screenshot
   notification **after** capture, not equivalent prevention; use it only for
   audit and redact the app switcher. For stronger control, issue corporate
   Android devices in dedicated/Lock Task mode or supervised iOS devices under
   MDM Single App Mode. MDM is an operational control, not web code.

Platform references: [Android `FLAG_SECURE`](https://developer.android.com/security/fraud-prevention/activities),
[Android foreground-service requirements](https://developer.android.com/about/versions/14/changes/fgs-types-required),
[Apple background location](https://developer.apple.com/documentation/corelocation/handling-location-updates-in-the-background),
and [Apple screenshot notification](https://developer.apple.com/documentation/uikit/uiapplication/userdidtakescreenshotnotification).

## API additions before a mobile rollout

Add these behind a mobile feature flag; do not repurpose the existing evidence
endpoints as an unrestricted background channel.

- Device enrollment/revocation with public key, app/version attestation, and
  device-bound refresh sessions stored only in platform-secure storage.
- `POST /api/visits/:visitId/mobile-session` for a short-lived,
  device/employee/visit-bound session after current ownership and state checks.
- Signed, ordered location heartbeats plus exit/re-entry events; reject stale,
  out-of-order, inaccurate, or unauthorized events.
- Per-file upload authorization/finalization carrying hash, byte count, media
  type, recording timestamps, and idempotency key. Recompute the digest and
  retain the current media validation before persistence.
- Immutable audit records for consent, permissions, recording lifecycle,
  policy decisions, uploads, rejections, and device revocation.

## Roadmap and acceptance gates

1. **Policy/threat model (1–2 weeks):** approve recording notice, retention,
   employee consent, supported regions, managed-device policy, lost-device
   response, and GPS grace thresholds. No automatic recording before approval.
2. **API/audit foundation (2–3 weeks):** add the mobile session, event, upload
   authorization, audit schema, feature flag, and ownership/replay/order tests.
3. **Android pilot (3–4 weeks):** foreground microphone/location services,
   encrypted queue, signed uploads, `FLAG_SECURE`, enrollment, and MDM. Test
   permission revocation, process death, GPS drift, interruptions, offline
   retry, low storage, root/attestation policy, screenshots, and casting.
4. **iOS pilot (3–4 weeks):** supported background audio/location, encrypted
   queue, app-switcher redaction, screenshot audit, and supervised-device MDM.
   Test termination, background transitions, permissions, and interruptions.
5. **Controlled rollout:** enrolled devices only; monitor upload integrity,
   false exits, completion, and policy violations. Require privacy, security,
   operations, and rollback sign-off before expansion.

Success means the native app enforces policy only to the degree the managed
platform permits while the server still rejects unauthorized media and state
transitions. No web page or app can absolutely prevent a person photographing a
screen.
