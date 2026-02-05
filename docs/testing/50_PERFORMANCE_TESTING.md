# Performance Testing

This guide explains how to set up lightweight performance testing for CloudVault.

## Metadata

- **Purpose**: Document baseline load testing setup and expected workflows.
- **Inputs**: Local environment, test data, and selected tooling (k6 or Artillery).
- **Outputs**: Performance baselines, reports, and regression signals.
- **Invariants**: Performance tests must not hit production data or secrets.

## Recommended Tooling

### Option A: k6 (preferred)

```bash
npm install --save-dev k6
```

Create a simple smoke test under `test/performance/`:

```javascript
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 10,
  duration: "30s",
};

export default function () {
  const res = http.get("http://localhost:5000/api/health");
  check(res, { "status is 200": (r) => r.status === 200 });
  sleep(1);
}
```

Run the test:

```bash
k6 run test/performance/health-check.js
```

### Option B: Artillery

```bash
npm install --save-dev artillery
```

```bash
artillery quick --count 50 --num 10 http://localhost:5000/api/health
```

## Baseline Targets

- **P95 response time**: < 500ms for read endpoints
- **Error rate**: < 1% during load
- **CPU usage**: Keep under 80% sustained

## Reporting

Capture results in a short summary and attach to PRs that change performance:

- Request rate
- P95 latency
- Error rate
- Observed bottlenecks

## Next Steps

Once tests are stable, add them to CI with an opt-in flag to avoid slowing normal builds.
