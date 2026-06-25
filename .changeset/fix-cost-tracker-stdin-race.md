---
'@harness-engineering/cli': patch
---

fix(hooks): cost-tracker no longer drops cost entries on a stdin pipe race

The Stop hook read stdin via `readFileSync(0)`, which throws `EAGAIN` when fd 0 is a non-blocking pipe whose data has not been delivered yet (observed under CI v8 coverage instrumentation). The hook caught the error and fail-opened, silently dropping the cost entry. The read now retries on `EAGAIN` with a bounded backoff; a genuinely empty stdin still returns immediately, so the fail-open paths stay fast.
