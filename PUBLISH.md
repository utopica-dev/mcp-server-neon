## Publish

### New release

```bash
npm run build
npm version patch|minor|major
npm publish
```

### New Beta Release

```bash
npm run build
npm version prerelease --preid=beta
npm publish --tag beta
```

### Promote beta to release

```bash
npm version patch
npm publish
```
