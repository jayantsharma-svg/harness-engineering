---
'@harness-engineering/cli': minor
---

Promote sentinel-pre/sentinel-post to the standard hook profile so default adopters get
prompt-injection defense out of the box. This changes default _blocking_ behavior:
in an already-tainted session, sentinel-pre can now block a destructive bash op for
projects on the standard profile (previously strict-only). Existing standard projects
pick up the hooks on their next `harness update`. cost-tracker remains strict-only.
