# Dev Environment Setup

## Prerequisites

Reserve a global static IP for dev ingress:

```bash
gcloud compute addresses create dragon-dev-ingress-ip --global --project=fair-backbone-479312-h7
```

Verify:

```bash
gcloud compute addresses describe dragon-dev-ingress-ip --global
```

## DNS Records (matbao.net)

Point these subdomains to the static IP above:

- `dev.dragon-template.xyz`
- `dev-api.dragon-template.xyz`
- `dev-keycloak.dragon-template.xyz`

## Keycloak Setup

After first deploy, run:

```bash
node infra/gke/dev/scripts/setup-keycloak.js \
  --admin-password=<keycloak-admin-password> \
  --client-secret=<keycloak-client-secret> \
  --test-user-password=<test-user-password>
```

This creates realm `dragon`, client `dragon-app`, and a test user on `https://dev-keycloak.dragon-template.xyz`.
