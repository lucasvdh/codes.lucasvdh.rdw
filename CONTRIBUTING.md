# Contributing

Thanks for helping out. Bugs and ideas go in [GitHub issues](https://github.com/lucasvdh/codes.lucasvdh.rdw/issues) or the [community topic](https://community.homey.app/t/92575).

## Development

```bash
npm ci
npm run typecheck && npm run lint && npm test && npm run check-locales
npm run homey-validate   # needs Docker
npm run homey-run        # runs the app on your own Homey
```

- `app.json` is generated and not committed. Edit `.homeycompose/` and `drivers/*/driver.compose.json`, and use the `npm run homey-*` scripts.
- Domain logic lives in `lib/` without Homey imports, with tests in `tests/`.
- Every bug fix starts with a test that fails without the fix.
- Never use a real license plate in tests, issues or commits.
- Conventional Commits, one topic per pull request.

The full conventions are in [`AGENTS.md`](AGENTS.md) and [`docs/`](docs/).
