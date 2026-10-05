# Test reports

| Report | File | How to regenerate |
| --- | --- | --- |
| Playwright HTML report (desktop and mobile Chromium, 101 passed, 1 desktop-only skip for touch controls) | `playwright/index.html` | `npm run test:e2e`, then copy `playwright-report/` |
| Vitest JUnit report (62 passed) | `vitest-junit.xml` | `npx vitest run --reporter=junit --outputFile.junit=docs/reports/vitest-junit.xml` |

Open the Playwright report with `npx playwright show-report docs/reports/playwright`. Traces and videos are only kept for failed tests, in `test-results/`, so a green run has none.
