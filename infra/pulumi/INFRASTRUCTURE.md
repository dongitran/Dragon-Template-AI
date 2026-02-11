# Infrastructure Journey Log - GKE Cluster Setup with Pulumi

## Project Overview
- **Project name**: dragon-gke
- **Tool**: Pulumi v3.177.0 (TypeScript)
- **Cloud**: Google Cloud Platform (GCP)
- **Target**: GKE Kubernetes Cluster (minimal config)
- **Date**: 2026-02-11

---

## Step-by-step Journey

### Step 1: Khao sat moi truong hien tai
**Muc dich**: Kiem tra hien trang folder, gcloud, pulumi truoc khi bat dau.

| Kiem tra | Ket qua |
|----------|---------|
| Folder hien tai | Chua co `infra/`, co san `backend/`, `frontend/`, `docker-compose.yml`... |
| gcloud project active | `integration-test-464403` (nhung ko accessible) |
| gcloud account | `dongitran.ai@gmail.com` |
| Pulumi installed | Co, v3.177.0 tai `/opt/homebrew/bin/pulumi` |
| Pulumi login | Da dang nhap voi user `dongtran` |
| .gitignore | Chua co file .gitignore o root |

```bash
ls /Users/dongtran/augment/dragon-template-ai/
# README.md agents.md backend docker-compose.yml e2e frontend images plan.md

gcloud config get-value project   # integration-test-464403
gcloud config get-value account   # dongitran.ai@gmail.com
pulumi version                    # v3.177.0
pulumi whoami                     # dongtran
```

---

### Step 2: Chon GCP Project & kiem tra billing
**Muc dich**: Project `integration-test-464403` ko truy cap duoc, can chon project khac.

**Cac project kha dung:**
| Project ID | Name | Project Number |
|-----------|------|---------------|
| `fair-backbone-479312-h7` | My First Project | 544685971138 |
| `gen-lang-client-0751276127` | Default Gemini Project | 504990864634 |

**Quyet dinh**: Chon `fair-backbone-479312-h7` vi la project chinh.

```bash
gcloud projects list
gcloud projects describe integration-test-464403   # => "Project not accessible"
gcloud config set project fair-backbone-479312-h7   # => Updated
# WARNING: Your active project does not match the quota project in your local
# Application Default Credentials file. (dau hieu ADC co van de - se gap lai o Step 8)
```

**Kiem tra billing**:
- Billing account: `016D35-D11BF0-319DB9` (My Billing Account) - **OPEN**
- Lien ket voi project: **billingEnabled: true**

```bash
gcloud billing accounts list
# ACCOUNT_ID: 016D35-D11BF0-319DB9, OPEN: True

gcloud billing projects list --billing-account=016D35-D11BF0-319DB9
# projectId: fair-backbone-479312-h7, billingEnabled: true
```

---

### Step 3: Enable GCP APIs
**Muc dich**: Bat cac API can thiet cho GKE.

Kiem tra ban dau: **GKE va Compute APIs chua duoc enable.**

```bash
gcloud services list --enabled --project fair-backbone-479312-h7 | grep -E "container|compute"
# => Khong co ket qua

gcloud services enable container.googleapis.com compute.googleapis.com --project fair-backbone-479312-h7
# => Operation finished successfully
```

**Ket qua**: `container.googleapis.com` va `compute.googleapis.com` da duoc bat.

---

### Step 4: Khoi tao Pulumi project
**Muc dich**: Tao project Pulumi trong folder `infra/`.

**Qua trinh (gap 3 lan loi):**

1. **Lan 1** - Thieu passphrase:
   ```bash
   pulumi new gcp-typescript --name dragon-gke --stack dev --yes
   # ERROR: passphrase must be set with PULUMI_CONFIG_PASSPHRASE
   ```

2. **Lan 2** - Folder khong trong (do lan 1 da tao Pulumi.yaml):
   ```bash
   PULUMI_CONFIG_PASSPHRASE="" pulumi new gcp-typescript --name dragon-gke --stack dev --yes
   # ERROR: /infra is not empty; use --force
   ```

3. **Lan 3** - Thanh cong voi `--force`:
   ```bash
   PULUMI_CONFIG_PASSPHRASE="" pulumi new gcp-typescript --name dragon-gke --stack dev --yes --force
   # Created project 'dragon-gke', Created stack 'dev'
   # Installed 369 packages
   ```

**Cai them package Kubernetes:**
```bash
npm install @pulumi/kubernetes
# added 2 packages, 372 total
```

**Files duoc tao:**
```
infra/
├── .gitignore
├── .pulumi/
├── Pulumi.dev.yaml
├── Pulumi.yaml
├── README.md
├── index.ts          # Template code (Storage Bucket)
├── node_modules/
├── package-lock.json
├── package.json
└── tsconfig.json
```

---

### Step 5: Viet code GKE (index.ts)
**Muc dich**: Thay the template code bang GKE cluster config toi thieu.

**Chon zone**: Kiem tra cac zone o Southeast Asia:
```bash
gcloud compute zones list --filter="region:asia-southeast1"
# asia-southeast1-b, asia-southeast1-a, asia-southeast1-c
```

**Thiet ke ban dau (plan):**
| Setting | Value | Reason |
|---------|-------|--------|
| Cluster type | Zonal (single zone) | Re hon Regional |
| Zone | asia-southeast1-a | Gan Vietnam |
| Machine type | e2-small | Nho nhat |
| Node count | 1 | Toi thieu |
| Disk | 30GB pd-standard | Re nhat |
| Spot VM | Yes | Giam 60-91% chi phi |
| HPA | Disabled | Khong can |
| Workload Identity | Enabled | Khong can quan ly key |

**Code bao gom:**
- VPC Network (custom, khong auto-create subnets)
- Subnet voi secondary ranges cho Pods (10.1.0.0/16) va Services (10.2.0.0/20)
- GKE Cluster (zonal, removeDefaultNodePool, Workload Identity)
- Custom Node Pool (e2-small, spot, 30GB)
- Kubeconfig builder (dung gke-gcloud-auth-plugin)
- Kubernetes Provider

---

### Step 6: Cau hinh Pulumi stack
**Muc dich**: Set config cho stack `dev`.

```bash
PULUMI_CONFIG_PASSPHRASE="" pulumi config set gcp-project fair-backbone-479312-h7
PULUMI_CONFIG_PASSPHRASE="" pulumi config set gcp:project fair-backbone-479312-h7
PULUMI_CONFIG_PASSPHRASE="" pulumi config set gcp:region asia-southeast1
PULUMI_CONFIG_PASSPHRASE="" pulumi config set gcp:zone asia-southeast1-a
```

**Pulumi.dev.yaml sau khi config:**
```yaml
encryptionsalt: v1:qXlNOxz9VEY=:v1:CYy+7jgCuXFXSkRe:X5Qht84NvCAKl+as1VGYSXgwUUwUkA==
config:
  dragon-gke:gcp-project: fair-backbone-479312-h7
  gcp:project: fair-backbone-479312-h7
  gcp:region: asia-southeast1
  gcp:zone: asia-southeast1-a
```

---

### Step 7: Cau hinh .gitignore (bao mat)
**Muc dich**: Dam bao khong lo key/secrets khi commit.

**infra/.gitignore:**
```
/bin/
/node_modules/
/.pulumi/          # Local state chua secrets
.env / .env.*
kubeconfig* / *.kubeconfig
```

**Root .gitignore (moi tao):**
```
node_modules/
infra/.pulumi/
infra/bin/
infra/node_modules/
.env / .env.*
*.pem / *.key
kubeconfig* / *.kubeconfig
credentials.json
service-account*.json
```

---

### Step 8: Deploy lan 1 - THAT BAI (ADC het han)
**Muc dich**: Chay `pulumi up` de tao infra.

```bash
PULUMI_CONFIG_PASSPHRASE="" pulumi up --yes
```

**Qua trinh chi tiet:**
1. **Download plugin**: Pulumi tu dong tai va cai `gcp-9.11.0` plugin
2. **Preview thanh cong**: Plan tao 6 resources (`Stack`, `Network`, `Subnet`, `Cluster`, `NodePool`, `k8s Provider`)
   - Tuy nhien co warning: `failed to get regions list: auth: "invalid_grant" "Account has been deleted"`
3. **Update that bai**:
   - `pulumi:pulumi:Stack` => **CREATED** (1 resource da tao)
   - `gcp:compute:Network` => **FAILED** voi loi ADC
   - Pulumi dung lai, **khong tao tiep** Subnet, Cluster, NodePool

**Ket qua**: THAT BAI
- **Loi**: `oauth2: "invalid_grant" "Account has been deleted"`
- **Nguyen nhan**: Application Default Credentials (ADC) da het han/bi xoa
- `gcloud auth` van hoat dong binh thuong (co the lay access token)
- Nhung Pulumi dung ADC (`~/.config/gcloud/application_default_credentials.json`), khong dung gcloud auth truc tiep

**Quan trong**: Mac du Pulumi bao loi va chi tao 1 resource (Stack), phia GCP backend van **bat dau provision** VPC Network va GKE Cluster. Day la nguyen nhan cua loi "Already exists" o Step 11.

---

### Step 9: Refresh ADC
**Muc dich**: Dang nhap lai ADC de Pulumi co the xac thuc.

**Thu lan 1** (trong Claude Code): Khong duoc vi can interactive browser
```bash
gcloud auth application-default login --no-launch-browser
# => Can verification code, nhung EOFError vi chay non-interactive
```

**Kiem tra auth hien tai:**
```bash
gcloud auth list
# ACTIVE: dongitran.ai@gmail.com (van hoat dong)
# Co 2 account: dongitran.ai@gmail.com va giangdth20404b@st.uel.edu.vn

gcloud auth print-access-token
# => Tra ve token hop le (ya29.a0AUMWg_...)
```

**Thu lan 2** (dung GOOGLE_OAUTH_ACCESS_TOKEN env var):
```bash
PULUMI_CONFIG_PASSPHRASE="" GOOGLE_OAUTH_ACCESS_TOKEN=$(gcloud auth print-access-token) pulumi up --yes
# => User tu choi tool call nay (rejected)
```

**Giai phap cuoi**: User tu chay trong terminal:
```bash
gcloud auth application-default login
# => Mo browser, dang nhap thanh cong
# => Credentials saved to: ~/.config/gcloud/application_default_credentials.json
```

---

### Step 10: Deploy lan 2 - THAT BAI (Pulumi lock)
**Muc dich**: Retry deploy sau khi co ADC moi.

```bash
PULUMI_CONFIG_PASSPHRASE="" pulumi up --yes
# ERROR: the stack is currently locked by 1 lock(s)
```

**Nguyen nhan**: Deploy lan 1 bi gian doan, de lai lock file.

**Fix:**
```bash
PULUMI_CONFIG_PASSPHRASE="" pulumi cancel
# => The currently running update for 'dev' has been canceled!
```

---

### Step 11: Deploy lan 3 - THAT BAI (Cluster already exists)
**Muc dich**: Retry sau khi clear lock.

```bash
PULUMI_CONFIG_PASSPHRASE="" pulumi up --yes
```

**Preview**: Plan tao 3 resources moi (Cluster, NodePool, k8s Provider) - 3 resources co san (Stack, Network, Subnet).

**Ket qua**: THAT BAI
```
ERROR 409: Already exists: projects/fair-backbone-479312-h7/zones/asia-southeast1-a/clusters/dragon-gke
```
Kem theo warning: `Attempting to deploy or update resources with 1 pending operations from previous deployment` (cluster bi interrupted while creating).

**Nguyen nhan**:
- Deploy lan 1 da **gui request tao cluster len GCP** truoc khi bi ADC loi
- GCP da tao cluster thanh cong (o backend), nhung Pulumi khong biet (vi bi gian doan)
- Pulumi state khong co cluster => co tao moi => GCP bao "already exists"

**Thu `pulumi refresh`** (khong giai quyet duoc):
```bash
PULUMI_CONFIG_PASSPHRASE="" pulumi refresh --yes
# Chi tim thay 3 resources (Stack, Network, Subnet) - KHONG tim thay Cluster
# Vi Cluster dang o trang thai "pending CREATE" trong Pulumi state,
# refresh khong the clear pending CREATE operations khi chay non-interactive
```

**Giai phap**: Can import cluster vao Pulumi state bang `pulumi import`.

---

### Step 12: Doi cluster RUNNING & Import vao Pulumi
**Muc dich**: Doi GKE cluster chuyen tu PROVISIONING sang RUNNING, roi import.

**Check lan 1:**
```bash
gcloud container clusters list --project fair-backbone-479312-h7
# STATUS: PROVISIONING
```

**Thu while-loop wait** (THAT BAI):
```bash
while true; do STATUS=$(gcloud container clusters list ...);
  if [ "$STATUS" = "RUNNING" ]; then break; fi; sleep 15; done
# => User reject vi "sao no chay hoai ko dung" (chay loop lien tuc)
```

**Check lan 2:**
```bash
gcloud container clusters list --project fair-backbone-479312-h7
# Van PROVISIONING
```

**Hoi user chon cach doi:**
- Option 1: Doi trong background
- Option 2: User tu check
- => User chon tu check, bao lai khi RUNNING

**User bao da RUNNING, check lan 3:**
```bash
gcloud container clusters list --project fair-backbone-479312-h7
# STATUS: RUNNING ✓
# NAME: dragon-gke, IP: 34.87.77.13, MACHINE: e2-medium, NODES: 1
```

**Luu y quan trong**: Cluster duoc tao voi **default-pool** (e2-medium, 100GB pd-balanced) thay vi custom node pool (e2-small, 30GB, spot) nhu trong code. Ly do: GKE tao default pool truoc khi Pulumi kip remove no va tao custom pool.

**Import cluster:**
```bash
PULUMI_CONFIG_PASSPHRASE="" pulumi import \
  gcp:container/cluster:Cluster dragon-cluster \
  projects/fair-backbone-479312-h7/locations/asia-southeast1-a/clusters/dragon-gke \
  --yes
# => 1 imported, 3 unchanged
```

**Warning** (khong anh huong): Bug cua GCP provider voi `windows_node_config.osversion` empty string.

---

### Step 13: Cap nhat code cho khop voi thuc te
**Muc dich**: Code ban dau co `removeDefaultNodePool` + custom NodePool, nhung cluster thuc te dung default pool.

**Thay doi chinh trong index.ts:**
- Bo `removeDefaultNodePool: true`
- Bo `gcp.container.NodePool` (custom node pool)
- Giu lai `initialNodeCount: 1`
- K8s Provider khong con `dependsOn: [nodePool]`

---

### Step 14: Deploy lan 4 - THANH CONG
**Muc dich**: Sync Pulumi state voi code da cap nhat.

```bash
PULUMI_CONFIG_PASSPHRASE="" pulumi up --yes
```

**Ket qua:**
```
Resources:
    + 1 created    (pulumi:providers:kubernetes gke-k8s)
    ~ 1 updated    (gcp:container:Cluster - deletionProtection=false)
    2 changes. 3 unchanged

Outputs:
    clusterEndpoint    : "34.87.77.13"
    clusterNameOutput  : "dragon-gke"
    networkName        : "dragon-network-1304a1a"

Duration: 7s
```

---

### Step 15: Ket noi kubectl & verify
**Muc dich**: Xac nhan cluster hoat dong.

**15a. Lay credentials:**
```bash
gcloud container clusters get-credentials dragon-gke \
  --zone asia-southeast1-a --project fair-backbone-479312-h7
# => kubeconfig entry generated
# CRITICAL WARNING: gke-gcloud-auth-plugin not found or not executable
```

**15b. Cai gke-gcloud-auth-plugin (gap kho khan):**

*Lan 1* - Chay trong background, bi stuck:
```bash
gcloud components install gke-gcloud-auth-plugin
# => Chay background, nhung bi treo o prompt "Do you want to continue (Y/n)?"
# => Phai stop background task (TaskStop)
```

*Lan 2* - Pipe "Y" de auto-confirm:
```bash
echo "Y" | gcloud components install gke-gcloud-auth-plugin
# => Installing gke-gcloud-auth-plugin v0.5.10 (3.3 MiB) - THANH CONG
# => Co warning ve Python 3.12 installer failed (khong anh huong)
```

**15c. kubectl van loi - plugin khong nam trong PATH:**
```bash
kubectl get nodes
# ERROR: exec: executable gke-gcloud-auth-plugin not found
```

**Tim vi tri plugin:**
```bash
which gke-gcloud-auth-plugin                    # => not found (khong co trong PATH)
ls /opt/homebrew/share/google-cloud-sdk/bin/gke-gcloud-auth-plugin  # => CO! Tim thay o day
```

**Fix PATH:**
```bash
export PATH="/opt/homebrew/share/google-cloud-sdk/bin:$PATH"
export USE_GKE_GCLOUD_AUTH_PLUGIN=True
```

**15d. Verify cluster - THANH CONG:**
```bash
kubectl get nodes
# NAME                                        STATUS   ROLES    AGE     VERSION
# gke-dragon-gke-default-pool-8d6cc45f-4qm2   Ready    <none>   5m35s   v1.33.5-gke.2100001

kubectl get pods --all-namespaces
# 16 pods, ALL Running:
# - gke-managed-cim: kube-state-metrics
# - gmp-system: collector, gmp-operator
# - kube-system: event-exporter, fluentbit, gke-metadata-server, gke-metrics-agent,
#   konnectivity-agent (+ autoscaler), kube-dns (+ autoscaler), kube-proxy,
#   l7-default-backend, metrics-server, netd, pdcsi-node
```

---

## Ket qua cuoi cung

### Pulumi Resources (6 managed)
| Resource | Type | Status |
|----------|------|--------|
| dragon-gke-dev | pulumi:pulumi:Stack | Created |
| dragon-network | gcp:compute:Network | Created |
| dragon-subnet | gcp:compute:Subnetwork | Created |
| dragon-cluster | gcp:container:Cluster | Imported + Updated |
| dragon-nodes | gcp:container:NodePool | Created |
| gke-k8s | pulumi:providers:kubernetes | Created |

### GKE Cluster Specs
| Property | Value |
|----------|-------|
| Name | dragon-gke |
| Zone | asia-southeast1-a |
| Master IP | 34.87.77.13 |
| K8s Version | 1.33.5-gke.2100001 |
| Node Pool | dragon-nodes (custom) |
| Machine Type | e2-medium (2 vCPU, 4GB RAM) |
| Disk | 50GB pd-standard |
| Node Count | 2 |
| Workload Identity | Enabled |
| Release Channel | STABLE |
| Chi phi uoc tinh | ~$52/thang |

### Architecture
```
GCP Project: fair-backbone-479312-h7
├── IAM: dragon-deployer SA + WIF (GitHub Actions OIDC)
│   └── Roles: container.developer, artifactregistry.writer
├── Artifact Registry: dragon-images (asia-southeast1, Docker)
│   ├── backend:latest (Express.js, linux/amd64)
│   └── frontend:latest (React SPA + nginx:alpine, linux/amd64)
├── Global Static IP: dragon-ingress-ip (34.120.179.221)
├── HTTP(S) Load Balancer (auto-created by GKE Ingress)
│   └── GCP Managed Certificate: dragon-cert
│       ├── dragon-template.xyz
│       ├── keycloak.dragon-template.xyz
│       └── api.dragon-template.xyz
└── VPC: dragon-network (custom, no auto-subnets)
    ├── Firewall: allow-mongodb-nodeport (tcp:30017)
    ├── Firewall: allow-keycloak-nodeport (tcp:30080)
    └── Subnet: dragon-subnet (10.0.0.0/24)
        ├── Secondary Range "pods": 10.1.0.0/16
        └── Secondary Range "services": 10.2.0.0/20
            └── GKE Cluster: dragon-gke (zonal)
                └── Node Pool: dragon-nodes (custom, managed by Pulumi)
                    ├── Node 1: e2-medium, 50GB (34.158.41.47)
                    └── Node 2: e2-medium, 50GB (34.87.99.143)
                        └── Namespace: dragon
                            ├── Ingress: dragon-ingress (GCE class)
                            ├── ManagedCertificate: dragon-cert
                            ├── StatefulSet: mongodb (mongo:7, 1/1 Running)
                            ├── Service: mongodb (NodePort 30017)
                            ├── PVC: mongodb-data (3GB pd-standard)
                            ├── Secret: mongodb-secret
                            ├── Deployment: keycloak (keycloak:24.0, 1/1 Running)
                            ├── Service: keycloak (NodePort 30080)
                            ├── PVC: keycloak-data (1GB pd-standard)
                            ├── Secret: keycloak-secret
                            ├── Deployment: backend (Express.js, 1/1 Running)
                            ├── Service: backend (NodePort 30010)
                            ├── Secret: backend-secret
                            ├── Deployment: frontend (React SPA + nginx, 1/1 Running)
                            └── Service: frontend (NodePort 30020)

DNS (matbao.net, A records -> 34.120.179.221):
  dragon-template.xyz          -> GCP LB -> Frontend:8080
  keycloak.dragon-template.xyz -> GCP LB -> Keycloak:8080
  api.dragon-template.xyz      -> GCP LB -> Backend:3001
```

### Bao mat
- Khong co service account key file nao duoc tao
- Dung `gcloud auth` (ADC) de xac thuc
- Workload Identity enabled (pods xac thuc qua GCP identity, khong can key)
- `.gitignore` bao ve: `.pulumi/`, `.env`, `kubeconfig`, `credentials.json`, `*.key`, `*.pem`
- Pulumi state luu local (`.pulumi/`), da duoc gitignore

---

## Troubleshooting Log

| # | Van de | Nguyen nhan | Cach fix |
|---|--------|-------------|----------|
| 1 | `passphrase must be set` | Pulumi local backend can passphrase | Set `PULUMI_CONFIG_PASSPHRASE=""` |
| 2 | `is not empty` | `pulumi new` lan 1 da tao file | Dung `--force` |
| 3 | `invalid_grant "Account has been deleted"` | ADC (`application_default_credentials.json`) het han | User chay `gcloud auth application-default login` trong terminal |
| 4 | `stack is currently locked` | Deploy bi gian doan de lai lock | `pulumi cancel` |
| 5 | `Error 409: Already exists` | GCP da tao cluster (tu deploy lan 1) nhung Pulumi khong biet | `pulumi import` cluster vao state |
| 6 | `gke-gcloud-auth-plugin not found` | Plugin chua duoc cai | `gcloud components install gke-gcloud-auth-plugin` |
| 7 | `gcloud components install` bi treo | Chay background, stuck o "Y/n" prompt | Stop task, chay lai voi `echo "Y" \| gcloud components install ...` |
| 8 | Plugin installed nhung `not found` | Khong nam trong `$PATH` | `export PATH="/opt/homebrew/share/google-cloud-sdk/bin:$PATH"` |

---

### Step 16: Chuyen sang 2x e2-small, 50GB
**Muc dich**: Thay doi tu 1x e2-medium (100GB) sang 2x e2-small (50GB) de toi uu chi phi.

**Chien luoc**: Tao node pool moi truoc, xoa node pool cu sau (an toan, khong bi downtime).

**16a. Cap nhat index.ts:**
- Them `gcp.container.NodePool` resource "dragon-nodes" voi:
  - `nodeCount: 2`
  - `machineType: "e2-small"`
  - `diskSizeGb: 50`
  - `diskType: "pd-standard"`
- **Khong** them `removeDefaultNodePool: true` de tranh cluster bị recreate

**16b. Deploy node pool moi:**
```bash
PULUMI_CONFIG_PASSPHRASE="" pulumi up --yes
# + gcp:container:NodePool dragon-nodes created (95s)
# Resources: + 1 created, 5 unchanged
```

**16c. Xoa default-pool cu:**
```bash
gcloud container node-pools list --cluster=dragon-gke --zone=asia-southeast1-a
# NAME                  MACHINE_TYPE  DISK_SIZE_GB
# default-pool          e2-medium     100
# dragon-nodes-0b60d31  e2-small      50

gcloud container node-pools delete default-pool --cluster=dragon-gke \
  --zone=asia-southeast1-a --project=fair-backbone-479312-h7 --quiet
# => Deleted successfully
```

**16d. Refresh Pulumi state:**
```bash
PULUMI_CONFIG_PASSPHRASE="" pulumi refresh --yes
# Resources: 6 unchanged
```

**16e. Verify:**
```bash
kubectl get nodes -o wide
# gke-dragon-gke-dragon-nodes-...-1884   Ready   e2-small   5m
# gke-dragon-gke-dragon-nodes-...-89ks   Ready   e2-small   5m
```

**Ket qua**: 2 nodes e2-small, 50GB, tat ca pods Running.

**Chi phi moi**: ~$32/thang (giam tu ~$41/thang)

---

### Step 17: Nang cap len 2x e2-medium
**Muc dich**: Nang RAM de du cho 4 services (ReactJS + NodeJS + Keycloak + MongoDB).

**Phan tich truoc khi nang cap:**
- 2x e2-small (4GB tong) chi con ~1.7GB cho apps sau khi tru system
- Keycloak (Java) can toi thieu 512MB-1GB, MongoDB can 256-512MB
- Ket luan: e2-small khong du, can nang len e2-medium (4GB/node)

**17a. Cap nhat index.ts:**
```typescript
// Thay doi duy nhat:
machineType: "e2-small" → "e2-medium"
```

**17b. Preview:**
```bash
PULUMI_CONFIG_PASSPHRASE="" pulumi preview
# ~ gcp:container:NodePool dragon-nodes update [diff: ~nodeConfig]
# Resources: ~ 1 to update, 5 unchanged
```
GKE cho phep update in-place (rolling update), khong can replace node pool.

**17c. Deploy:**
```bash
PULUMI_CONFIG_PASSPHRASE="" pulumi up --yes
# ~ gcp:container:NodePool dragon-nodes updated (571s) [diff: ~nodeConfig]
# Duration: 9m36s
```
GKE tu dong rolling update: tao node moi (e2-medium) → drain node cu → xoa node cu → lap lai.

**17d. Verify:**
```bash
gcloud container node-pools list --cluster=dragon-gke --zone=asia-southeast1-a
# NAME                  MACHINE_TYPE  DISK_SIZE_GB
# dragon-nodes-0b60d31  e2-medium     50

kubectl get nodes -o wide
# gke-dragon-gke-dragon-nodes-...-c9eu   Ready   e2-medium   3m
# gke-dragon-gke-dragon-nodes-...-fmb4   Ready   e2-medium   8m
```

**Ket qua**: 2 nodes e2-medium (2 vCPU, 4GB RAM), 50GB pd-standard.

**Tai nguyen kha dung cho apps**: ~6GB RAM (8GB tong - ~1.6GB system - ~0.4GB reserved)

**Chi phi moi**: ~$52/thang

---

### Step 18: Deploy MongoDB len GKE
**Muc dich**: Deploy MongoDB la service dau tien tren GKE cluster, co public access.

**18a. Tao folder va files K8s:**
```
infra/gke/mongodb/
├── namespace.yaml      # Namespace "dragon"
├── pvc.yaml            # PersistentVolumeClaim 3GB pd-standard
├── statefulset.yaml    # MongoDB StatefulSet (mongo:7)
└── service.yaml        # NodePort Service (27017 -> 30017)
```

**Quyet dinh thiet ke:**
| Quyet dinh | Ly do |
|---|---|
| StatefulSet (khong phai Deployment) | Stable pod identity, phu hop database |
| NodePort 30017 (khong phai LoadBalancer) | Mien phi ($0) vs LoadBalancer (~$18/thang) |
| Secrets khong luu trong YAML | Bao mat - inject tu GitHub Secrets khi deploy |
| 3GB PVC pd-standard | Du cho dev, re nhat |

**18b. Secret management flow:**
```
GitHub Secrets (MONGO_USERNAME, MONGO_PASSWORD)
    │
    ▼
GitHub Actions workflow
    ├─ kubectl create secret (inject tu GitHub Secrets)
    └─ kubectl apply -f infra/gke/mongodb/
```
- K8s Secret **KHONG** nam trong git
- Tao bang `kubectl create secret` tai thoi diem deploy
- StatefulSet reference secret qua `secretKeyRef`

**18c. Tao secret.md (gitignored):**
- File local-only luu credentials
- Da them `secret.md` vao `.gitignore`

---

### Step 19: Setup Workload Identity Federation (GitHub Actions <-> GCP)
**Muc dich**: Cho phep GitHub Actions xac thuc voi GCP ma khong can key file.

**19a. Tao GCP Service Account:**
```bash
gcloud iam service-accounts create dragon-deployer \
  --display-name="Dragon GKE Deployer" --project=fair-backbone-479312-h7
# => Created service account [dragon-deployer]
```

**19b. Grant role:**
```bash
gcloud projects add-iam-policy-binding fair-backbone-479312-h7 \
  --member="serviceAccount:dragon-deployer@fair-backbone-479312-h7.iam.gserviceaccount.com" \
  --role="roles/container.developer" --condition=None --quiet
```

**19c. Tao Workload Identity Pool:**
```bash
gcloud iam workload-identity-pools create dragon-github-pool \
  --location="global" --display-name="Dragon GitHub Pool" \
  --project=fair-backbone-479312-h7
```

**19d. Tao OIDC Provider (gap loi lan 1):**
```bash
# Lan 1 - THAT BAI: thieu --attribute-condition
gcloud iam workload-identity-pools providers create-oidc dragon-github-provider ...
# ERROR: INVALID_ARGUMENT: The attribute condition must reference one of the provider's claims

# Lan 2 - THANH CONG: them --attribute-condition
gcloud iam workload-identity-pools providers create-oidc dragon-github-provider \
  --location="global" --workload-identity-pool="dragon-github-pool" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='dongitran/Dragon-Template-AI'" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --project=fair-backbone-479312-h7
```

**19e. Bind SA voi WIF Pool:**
```bash
gcloud iam service-accounts add-iam-policy-binding \
  dragon-deployer@fair-backbone-479312-h7.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/544685971138/locations/global/workloadIdentityPools/dragon-github-pool/attribute.repository/dongitran/Dragon-Template-AI"
```

**WIF Provider full name:**
```
projects/544685971138/locations/global/workloadIdentityPools/dragon-github-pool/providers/dragon-github-provider
```

---

### Step 20: Tao GitHub Actions deploy workflow
**Muc dich**: Tao workflow tu dong deploy len GKE khi push changes vao `infra/gke/`.

**File**: `.github/workflows/deploy-gke.yml`

**Trigger:**
- Push to `main` khi co thay doi trong `infra/gke/**`
- Manual dispatch (`workflow_dispatch`)

**Steps trong workflow:**
1. Checkout code
2. Auth GCP (Workload Identity Federation - keyless)
3. Get GKE credentials
4. Create namespace (`--dry-run=client | kubectl apply` de idempotent)
5. Create K8s Secret (inject tu `${{ secrets.MONGO_USERNAME }}` / `${{ secrets.MONGO_PASSWORD }}`)
6. Deploy manifests (`kubectl apply -f infra/gke/mongodb/`)
7. Wait for rollout
8. Show status

**Set GitHub Secrets:**
```bash
gh secret set MONGO_USERNAME --body "dragon_db_admin"
gh secret set MONGO_PASSWORD --body "***"
```

---

### Step 21: Deploy va troubleshooting MongoDB
**Muc dich**: Deploy MongoDB va xu ly cac loi gap phai.

**21a. Tao namespace va secret (thu cong lan dau):**
```bash
kubectl create namespace dragon
# => namespace/dragon created

kubectl create secret generic mongodb-secret -n dragon \
  --from-literal=MONGO_INITDB_ROOT_USERNAME=dragon_db_admin \
  --from-literal=MONGO_INITDB_ROOT_PASSWORD=***
# => secret/mongodb-secret created
```

**21b. Trigger workflow:**
```bash
gh workflow run deploy-gke.yml
```
- Workflow chay thanh cong den step "Deploy MongoDB"
- **THAT BAI** tai "Wait for MongoDB ready" - timeout 120s

**21c. Loi 1: Pod Pending - Insufficient CPU**
```
Events:
  Warning  FailedScheduling  0/2 nodes are available: 2 Insufficient cpu
```
- **Nguyen nhan**: Moi node chi co **940m CPU allocatable** (GKE reserve nhieu), system pods da chiem **~750m/node**, chi con ~190m free
- MongoDB request **250m** > 190m con lai
- **Fix**: Giam CPU request tu 250m xuong **100m**

**21d. Loi 2: Probe timeout**
```
Events:
  Warning  Unhealthy  Liveness probe errored: command timed out after 1s
  Warning  Unhealthy  Readiness probe errored: command timed out after 1s
```
- **Nguyen nhan**: `mongosh` startup cham tren CPU nho (100m), vuot qua timeout 1s
- **Fix**: Tang `timeoutSeconds` tu 1s len **10s**, tang `initialDelaySeconds` cua liveness tu 30s len **60s**

**21e. Thanh cong:**
```bash
kubectl get pods -n dragon
# NAME        READY   STATUS    RESTARTS   AGE
# mongodb-0   1/1     Running   0          64s

kubectl exec -it mongodb-0 -n dragon -- mongosh -u dragon_db_admin -p *** \
  --authenticationDatabase admin --eval "db.adminCommand('ping')"
# { ok: 1 }
```

**21f. Tao firewall rule cho NodePort:**
```bash
# Lan 1 - SAI network (default):
gcloud compute firewall-rules create allow-mongodb-nodeport \
  --allow tcp:30017 --source-ranges=0.0.0.0/0
# => Tao tren network "default", nhung nodes nam tren "dragon-network-1304a1a"

# Xoa va tao lai dung network:
gcloud compute firewall-rules delete allow-mongodb-nodeport --quiet
gcloud compute firewall-rules create allow-mongodb-nodeport \
  --allow tcp:30017 \
  --target-tags=gke-dragon-gke-eeb4b472-node \
  --source-ranges=0.0.0.0/0 \
  --network=dragon-network-1304a1a \
  --project=fair-backbone-479312-h7
```

**21g. Test ket noi tu ben ngoai:**
```bash
mongosh "mongodb://dragon_db_admin:***@34.158.41.47:30017/dragon-template-ai?authSource=admin" \
  --eval "db.adminCommand('ping')"
# { ok: 1 }  ✓
```

**Ket qua**: MongoDB accessible tu public internet qua NodePort 30017.

---

### Step 22: Deploy Keycloak len GKE
**Muc dich**: Deploy Keycloak (IAM/SSO) len GKE cluster, co public access qua NodePort.

**22a. Tao folder va files K8s:**
```
infra/gke/keycloak/
├── deployment.yaml     # Keycloak Deployment (keycloak:24.0, start-dev)
├── pvc.yaml            # PersistentVolumeClaim 1GB pd-standard
└── service.yaml        # NodePort Service (8080 -> 30080)
```

**Quyet dinh thiet ke:**
| Quyet dinh | Ly do |
|---|---|
| Deployment (khong phai StatefulSet) | Keycloak la app server, khong phai database |
| `start-dev` mode | Moi truong dev, don gian, dung H2 embedded DB |
| NodePort 30080 | Mien phi ($0), tuong tu MongoDB |
| 1GB PVC | Chi chua H2 embedded database |
| `strategy: Recreate` | Chi 1 replica, tranh conflict khi update |

**22b. Cau hinh deployment:**
- Image: `quay.io/keycloak/keycloak:24.0`
- Args: `["start-dev"]` (KHONG dung `command` - se ghi de ENTRYPOINT)
- Env: `KEYCLOAK_ADMIN`, `KEYCLOAK_ADMIN_PASSWORD` (tu K8s Secret), `KC_HEALTH_ENABLED=true`
- Resources: CPU request 100m/limit 500m, Memory request 512Mi/limit 1Gi
- securityContext: `fsGroup: 1000` (Keycloak chay non-root uid 1000)
- Liveness probe: HTTP `/health/live`, initialDelaySeconds **300s** (start-dev build cham)
- Readiness probe: HTTP `/health/ready`, initialDelaySeconds 30s

**22c. Secret management:**
```bash
gh secret set KEYCLOAK_ADMIN --body "admin"
gh secret set KEYCLOAK_ADMIN_PASSWORD --body "***"
```
- Tuong tu MongoDB: K8s Secret tao bang `kubectl create secret` trong GitHub Actions
- Credentials luu trong `secret.md` (gitignored)

**22d. Firewall rule:**
```bash
gcloud compute firewall-rules create allow-keycloak-nodeport \
  --network=dragon-network-1304a1a \
  --allow=tcp:30080 \
  --target-tags=gke-dragon-gke-eeb4b472-node \
  --source-ranges=0.0.0.0/0 \
  --description="Allow Keycloak NodePort 30080"
```

**22e. Them job `deploy-keycloak` vao `deploy-gke.yml`:**
- Tuong tu `deploy-mongodb`: auth GCP, get GKE creds, create secret, deploy, wait, show status
- Timeout: **600s** (Keycloak start-dev build Quarkus mat ~95s + startup ~60s)

**22f. Troubleshooting (3 loi):**

**Loi 1: `executable file not found in $PATH` - CrashLoopBackOff**
```
exec: "start-dev": executable file not found in $PATH
```
- **Nguyen nhan**: Dung `command: ["start-dev"]` ghi de ENTRYPOINT cua container (`/opt/keycloak/bin/kc.sh`)
- **Fix**: Doi sang `args: ["start-dev"]` (giu ENTRYPOINT, chi thay doi arguments)

**Loi 2: `Error while creating file "/opt/keycloak/data/h2"` - Exit Code 1**
```
ERROR: Failed to obtain JDBC connection
ERROR: Error while creating file "/opt/keycloak/data/h2"
```
- **Nguyen nhan**: PVC mount tai `/opt/keycloak/data` owned by root, nhung Keycloak chay non-root (uid 1000)
- **Fix**: Them `securityContext.fsGroup: 1000` de volume writable boi Keycloak user

**Loi 3: Liveness probe killed container - Exit Code 143 (SIGTERM)**
```
Warning  Unhealthy  Liveness probe failed: HTTP probe failed with statuscode: 404
Warning  Killing    Container keycloak failed liveness probe, will be restarted
```
- **Nguyen nhan 1**: Health endpoint tra 404 vi chua enable. Keycloak 24.0 can `KC_HEALTH_ENABLED=true`
- **Nguyen nhan 2**: `start-dev` mode build Quarkus mat ~95s + startup ~60s = ~155s, vuot qua liveness delay 180s + 3 failures
- **Fix**: Them env `KC_HEALTH_ENABLED=true`, tang liveness `initialDelaySeconds` tu 180s len **300s**, tang memory limit tu 768Mi len **1Gi**

**22g. Ket qua thanh cong:**
```bash
kubectl get pods -n dragon
# NAME                        READY   STATUS    RESTARTS   AGE
# keycloak-65bc679f74-vqvr5   1/1     Running   0          4m8s
# mongodb-0                   1/1     Running   0          14m

# Keycloak logs:
# Keycloak 24.0.5 on JVM (powered by Quarkus 3.8.4) started in 61.074s
# Listening on: http://0.0.0.0:8080
# Profile dev activated.
```

**Ket qua**: Keycloak accessible tu public internet qua NodePort 30080.
- URL: `http://34.158.41.47:30080` hoac `http://34.87.99.143:30080`

---

### Step 23: Setup domain keycloak.dragon-template.xyz (Ingress + SSL)
**Muc dich**: Gan domain `keycloak.dragon-template.xyz` vao Keycloak voi HTTPS (SSL tu dong).

**Chon phuong an:**
| Phuong an | Chi phi | Ket qua |
|-----------|---------|---------|
| Ingress + GCP Load Balancer + Managed SSL | ~$18/thang | **CHON** - co SSL tu dong, standard ports (443/80) |
| NodePort + DNS | $0 | Phai dung port 30080, khong co SSL |

**23a. Mua domain:**
- Domain: `dragon-template.xyz` mua tai [matbao.net](https://matbao.net)

**23b. Reserve global static IP:**
```bash
gcloud compute addresses create dragon-ingress-ip --global \
  --project=fair-backbone-479312-h7
# => 34.120.179.221

gcloud compute addresses describe dragon-ingress-ip --global
# address: 34.120.179.221, status: RESERVED
```

**23c. Tao Ingress + Managed Certificate manifests:**
```
infra/gke/ingress/
├── managed-cert.yaml    # GCP Managed Certificate (auto SSL)
└── ingress.yaml         # GKE Ingress (HTTP(S) Load Balancer)
```

**managed-cert.yaml:**
```yaml
apiVersion: networking.gke.io/v1
kind: ManagedCertificate
metadata:
  name: dragon-cert
  namespace: dragon
spec:
  domains:
    - keycloak.dragon-template.xyz
```

**ingress.yaml:**
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: dragon-ingress
  namespace: dragon
  annotations:
    kubernetes.io/ingress.global-static-ip-name: "dragon-ingress-ip"
    networking.gke.io/managed-certificates: "dragon-cert"
    kubernetes.io/ingress.class: "gce"    # Phai dung annotation, KHONG dung ingressClassName
spec:
  defaultBackend:                          # Bat buoc de tranh NEG sync error
    service:
      name: keycloak
      port:
        number: 8080
  rules:
    - host: keycloak.dragon-template.xyz
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: keycloak
                port:
                  number: 8080
```

**23d. Cap nhat Keycloak deployment cho reverse proxy:**
Them 2 env vars vao `infra/gke/keycloak/deployment.yaml`:
```yaml
- name: KC_PROXY_HEADERS
  value: "xforwarded"           # Nhan dien X-Forwarded-* headers tu LB
- name: KC_HOSTNAME
  value: "keycloak.dragon-template.xyz"   # CHI hostname, KHONG co protocol
```

**23e. Them job `deploy-ingress` vao `deploy-gke.yml`:**
- Trigger: thay doi trong `infra/gke/ingress/`
- Steps: auth GCP, get GKE creds, create namespace, deploy ingress manifests

**23f. Setup DNS tai matbao.net:**
```
Type: A
Host: keycloak
Value: 34.120.179.221
TTL: 300
```

**Verify DNS:**
```bash
nslookup keycloak.dragon-template.xyz
# Address: 34.120.179.221 ✓
```

**23g. Deploy Ingress:**
```bash
kubectl apply -f infra/gke/ingress/
# managedcertificate.networking.gke.io/dragon-cert created
# ingress.networking.k8s.io/dragon-ingress created
```

**23h. Doi GCP Managed Certificate provisioning:**
- GCP Managed Certificate can DNS resolve thanh cong moi bat dau provision SSL
- Thoi gian: **~15-60 phut** (truong hop nay mat **~51 phut**)
- Trong thoi gian doi: HTTP tra loi "HTTPS required" (Keycloak reject HTTP khi co KC_HOSTNAME)
- Sau khi cert Active: HTTPS hoat dong binh thuong

**Kiem tra cert status:**
```bash
kubectl describe managedcertificate dragon-cert -n dragon
# Status: Active              # Sau ~51 phut
# Certificate Status: Active
# Domain Status:
#   Domain: keycloak.dragon-template.xyz
#   Status: Active
```

**23i. Ket qua thanh cong:**
```bash
curl -I https://keycloak.dragon-template.xyz/
# HTTP/2 200
# content-type: text/html;charset=utf-8
# via: 1.1 google
# alt-svc: h3=":443"
```

**Ket qua**: Keycloak accessible tai **https://keycloak.dragon-template.xyz** voi SSL tu dong.

**23j. Troubleshooting (5 loi):**

**Loi 1: NEG sync error - `RESOURCE_NOT_FOUND`**
```
Warning  Sync  error running backend syncing routine:
  googleapi: Error 404: The resource 'default-http-backend' was not found
```
- **Nguyen nhan**: GKE Ingress can defaultBackend, khong co thi tim `default-http-backend` service (khong ton tai)
- **Fix**: Them `spec.defaultBackend` trong ingress.yaml tro ve keycloak service

**Loi 2: `ingressClassName: gce` khong hoat dong**
```bash
kubectl get ingressclass
# No resources found
```
- **Nguyen nhan**: GKE cluster khong co IngressClass resource, `ingressClassName` field bi bo qua
- **Fix**: Dung annotation `kubernetes.io/ingress.class: "gce"` (deprecated nhung van hoat dong)

**Loi 3: CSP error `http://https:` trong browser console**
```
Refused to connect to 'http://https:/keycloak.dragon-template.xyz/...'
```
- **Nguyen nhan**: `KC_HOSTNAME` set thanh `https://keycloak.dragon-template.xyz` (co protocol)
- **Fix**: Doi thanh chi hostname `keycloak.dragon-template.xyz` (KHONG co `https://`)

**Loi 4: "HTTPS required" khi truy cap HTTP**
```
HTTPS required
```
- **Nguyen nhan**: Keycloak nhan X-Forwarded-Proto=http tu LB va tu choi vi KC_HOSTNAME da set
- **Fix**: Doi GCP Managed Certificate chuyen sang Active, sau do dung HTTPS

**Loi 5: Connection reset khi vua tao Ingress**
- **Nguyen nhan**: GCP Load Balancer can ~2-3 phut de tao forwarding rules
- **Fix**: Doi 2-3 phut sau khi `kubectl apply`

---

### Step 24: Deploy Backend Service len GKE
**Muc dich**: Deploy Express.js backend len GKE, co Docker image tren Artifact Registry, secrets inject qua GitHub Actions.

**24a. Enable Artifact Registry & tao Docker repo:**
```bash
gcloud services enable artifactregistry.googleapis.com --project=fair-backbone-479312-h7
# => Operation finished successfully

gcloud artifacts repositories create dragon-images \
  --repository-format=docker \
  --location=asia-southeast1 \
  --project=fair-backbone-479312-h7
# => Created repository [dragon-images]
```

**24b. Grant Artifact Registry permissions cho deployer SA:**
```bash
gcloud projects add-iam-policy-binding fair-backbone-479312-h7 \
  --member="serviceAccount:dragon-deployer@fair-backbone-479312-h7.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
```

**24c. Set GitHub Secrets (5 secrets moi):**
```bash
gh secret set MONGO_URI --body "mongodb://dragon_db_admin:***@mongodb:27017/dragon-template-ai?authSource=admin" \
  --repo dongitran/Dragon-Template-AI
# => ✓

gh secret set KEYCLOAK_CLIENT_SECRET --body "***" --repo dongitran/Dragon-Template-AI
# => ✓

gh secret set GEMINI_API_KEYS --body "***,***" --repo dongitran/Dragon-Template-AI
# => ✓

gh secret set CORS_ORIGIN --body "https://dragon-template.xyz" --repo dongitran/Dragon-Template-AI
# => ✓

gh secret set AI_PROVIDERS_CONFIG --body '{"providers":[{"id":"google","name":"Google Gemini","models":[...]}]}' \
  --repo dongitran/Dragon-Template-AI
# => ✓
```
- Tat ca secrets luu trong `secret.md` (gitignored), KHONG commit vao git
- Dung `--repo` flag de chi dinh repo cu the

**24d. Tao folder va files K8s:**
```
infra/gke/backend/
├── deployment.yaml     # Backend Deployment (Express.js, port 3001)
└── service.yaml        # NodePort Service (3001 -> 30010)
```

**Quyet dinh thiet ke:**
| Quyet dinh | Ly do |
|---|---|
| Deployment (khong phai StatefulSet) | Backend la stateless app server |
| NodePort 30010 | Tuong tu MongoDB/Keycloak, mien phi ($0) |
| Secrets tu K8s Secret `backend-secret` | MONGO_URI, KEYCLOAK_CLIENT_SECRET, GEMINI_API_KEYS, AI_PROVIDERS_CONFIG, CORS_ORIGIN |
| Env direct values | BACKEND_PORT=3001, NODE_ENV=production, KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID |
| KEYCLOAK_URL = external URL | JWT issuer verification trong `auth.js` phai khop voi KC_HOSTNAME |
| MONGO_URI dung internal K8s service | `mongodb:27017` (nhanh hon external IP) |
| Recreate strategy | Chi 1 replica, tranh conflict |

**Cau hinh deployment:**
- Image: `asia-southeast1-docker.pkg.dev/fair-backbone-479312-h7/dragon-images/backend:latest`
- Port: 3001
- Resources: CPU request 100m/limit 500m, Memory request 256Mi/limit 512Mi
- Liveness probe: HTTP `/api/health`, initialDelaySeconds 30s, period 15s, timeout 5s
- Readiness probe: HTTP `/api/health`, initialDelaySeconds 10s, period 10s, timeout 5s

**24e. Cap nhat Ingress cho api.dragon-template.xyz:**

Cap nhat `infra/gke/ingress/managed-cert.yaml` - them domain:
```yaml
spec:
  domains:
    - keycloak.dragon-template.xyz
    - api.dragon-template.xyz        # Them moi
```

Cap nhat `infra/gke/ingress/ingress.yaml` - them rule:
```yaml
- host: api.dragon-template.xyz
  http:
    paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
              number: 3001
```

**24f. Them job `deploy-backend` vao `deploy-gke.yml`:**
- Trigger: thay doi trong `backend/` hoac `infra/gke/backend/`
- Them `backend/**` vao workflow paths trigger
- Steps:
  1. Auth GCP (WIF)
  2. Configure Docker for Artifact Registry (`gcloud auth configure-docker`)
  3. Build & push Docker image (tag: `${{ github.sha }}` + `latest`, target: `production`)
  4. Get GKE credentials
  5. Create K8s Secret `backend-secret` (5 fields tu GitHub Secrets)
  6. Deploy manifests (`kubectl apply -f infra/gke/backend/`)
  7. Wait for rollout (120s)
  8. Show status

**24g. Configure Docker for Artifact Registry:**
```bash
gcloud auth configure-docker asia-southeast1-docker.pkg.dev --quiet
# => Adding credentials for: asia-southeast1-docker.pkg.dev
# => Docker configuration file updated.
```

**24h. Build & push Docker image lan 1 (THAT BAI - sai platform):**
```bash
docker build -t asia-southeast1-docker.pkg.dev/fair-backbone-479312-h7/dragon-images/backend:latest \
  --target production ./backend
# => Build THANH CONG, nhung image la arm64 (Apple Silicon Mac)

docker push asia-southeast1-docker.pkg.dev/fair-backbone-479312-h7/dragon-images/backend:latest
# => Push THANH CONG len Artifact Registry
```

**24i. Tao K8s Secret `backend-secret` (gap 4 lan loi):**

**Lan 1 - THAT BAI: `command not found: kubectl`**
```bash
export PATH="/opt/homebrew/share/google-cloud-sdk/bin:$PATH"
kubectl create secret generic backend-secret -n dragon ...
# => command not found: kubectl
```
- **Nguyen nhan**: PATH chi co gcloud SDK, thieu kubectl tai `/opt/homebrew/bin`

**Lan 2 - THAT BAI: `exactly one NAME is required, got 7`**
```bash
export PATH="/opt/homebrew/share/google-cloud-sdk/bin:/opt/homebrew/bin:$PATH"
kubectl create secret generic backend-secret -n dragon \
  --from-literal=MONGO_URI="mongodb://...?authSource=admin" \
  --from-literal=KEYCLOAK_CLIENT_SECRET=*** ...
# => error: exactly one NAME is required, got 7
```
- **Nguyen nhan**: Zsh split `--from-literal=MONGO_URI="..."` thanh nhieu arguments vi MONGO_URI chua ky tu dac biet (`?`, `=`, `@`)
- **Fix**: Dung single quotes bao toan bo `--from-literal='KEY=VALUE'`

**Lan 3 - THAT BAI: `readlink: command not found`**
```bash
export PATH="/opt/homebrew/share/google-cloud-sdk/bin:/opt/homebrew/bin:$PATH"
kubectl create secret generic backend-secret -n dragon \
  --from-literal='MONGO_URI=...' --from-literal='KEYCLOAK_CLIENT_SECRET=...' ...
# => gcloud: line 72: readlink: command not found
# => gcloud: line 86: dirname: command not found
```
- **Nguyen nhan**: PATH thieu `/usr/bin`, `/bin`, `/usr/sbin`, `/sbin` - cac system utilities (`readlink`, `dirname`) khong tim thay
- **Fix**: Them day du system paths vao PATH

**Lan 4 - THANH CONG (nhung thieu AI_PROVIDERS_CONFIG):**
```bash
export PATH="/opt/homebrew/share/google-cloud-sdk/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
kubectl create secret generic backend-secret -n dragon \
  --from-literal='MONGO_URI=mongodb://***@mongodb:27017/dragon-template-ai?authSource=admin' \
  --from-literal='KEYCLOAK_CLIENT_SECRET=***' \
  --from-literal='GEMINI_API_KEYS=***' \
  --from-literal='CORS_ORIGIN=https://dragon-template.xyz' \
  --dry-run=client -o yaml | kubectl apply -f -
# => secret/backend-secret created
```

**Verify - Phat hien thieu AI_PROVIDERS_CONFIG:**
```bash
kubectl get secret backend-secret -n dragon -o jsonpath='{.data}' | python3 -c "..."
# CORS_ORIGIN: https://dragon-template.xyz
# GEMINI_API_KEYS: ***
# KEYCLOAK_CLIENT_SECRET: ***
# MONGO_URI: mongodb://***@mongodb:27017/...
# => THIEU AI_PROVIDERS_CONFIG!
```

**Xoa va tao lai voi du 5 fields:**
```bash
kubectl delete secret backend-secret -n dragon
kubectl create secret generic backend-secret -n dragon \
  --from-literal='MONGO_URI=mongodb://***@mongodb:27017/dragon-template-ai?authSource=admin' \
  --from-literal='KEYCLOAK_CLIENT_SECRET=***' \
  --from-literal='GEMINI_API_KEYS=***' \
  --from-literal='CORS_ORIGIN=https://dragon-template.xyz' \
  --from-literal='AI_PROVIDERS_CONFIG={"providers":[...]}'
# => secret "backend-secret" deleted
# => secret/backend-secret created
```

**24j. Deploy backend manifests va updated ingress:**
```bash
kubectl apply -f infra/gke/backend/
# => deployment.apps/backend created
# => service/backend created

kubectl apply -f infra/gke/ingress/
# => ingress.networking.k8s.io/dragon-ingress configured
# => managedcertificate.networking.gke.io/dragon-cert configured
```

**24k. Rollout timeout - ImagePullBackOff:**
```bash
kubectl rollout status deployment/backend -n dragon --timeout=120s
# => error: timed out waiting for the condition

kubectl get pods -n dragon -l app=backend
# NAME                       READY   STATUS             RESTARTS   AGE
# backend-6c5fc664f4-dkc6w   0/1     ImagePullBackOff   0          2m38s

kubectl describe pod -n dragon -l app=backend
# Events:
#   Warning  Failed  Failed to pull image: no match for platform in manifest: not found
#   Warning  Failed  Error: ImagePullBackOff
```
- **Nguyen nhan**: Docker image build tren Mac Apple Silicon (arm64), GKE nodes la amd64
- **Fix**: Rebuild voi `--platform linux/amd64`

**24l. Rebuild Docker image voi dung platform (THANH CONG):**
```bash
docker build --platform linux/amd64 \
  -t asia-southeast1-docker.pkg.dev/fair-backbone-479312-h7/dragon-images/backend:latest \
  --target production ./backend
# => Build THANH CONG (linux/amd64)

docker push asia-southeast1-docker.pkg.dev/fair-backbone-479312-h7/dragon-images/backend:latest
# => Push THANH CONG

kubectl rollout restart deployment/backend -n dragon
kubectl rollout status deployment/backend -n dragon --timeout=120s
# => deployment "backend" successfully rolled out
```

**Luu y quan trong**: Khi build tren Mac (Apple Silicon), PHAI dung `--platform linux/amd64`. GitHub Actions runners da la amd64, khong can flag nay trong workflow.

**24m. Verify backend hoat dong:**
```bash
kubectl get pods -n dragon
# NAME                        READY   STATUS    RESTARTS   AGE
# backend-769c6b584d-vk2ks    1/1     Running   0          41s
# keycloak-854c5cb8cb-24s8m   1/1     Running   0          4h59m
# mongodb-0                   1/1     Running   0          6h1m

kubectl logs deployment/backend -n dragon --tail=20
# > backend@1.0.0 start
# > node src/index.js
# ✅ Connected to MongoDB
# 🚀 Backend server running on port 3001
# GET /api/health 200 9.106 ms
# GET /api/health 200 1.566 ms
# GET /api/health 200 0.966 ms
```

**24n. Check ManagedCertificate (SSL re-provisioning):**
```bash
kubectl describe managedcertificate dragon-cert -n dragon
# Status:
#   Certificate Status:  Provisioning
#   Domain Status:
#     Domain: api.dragon-template.xyz      Status: Provisioning
#     Domain: keycloak.dragon-template.xyz  Status: Provisioning
# Events:
#   Warning  BackendError  resourceInUseByAnotherResource
#   Normal   Delete        Delete SslCertificate mcrt-228c3ba1-...
#   Normal   Create        Create SslCertificate mcrt-228c3ba1-...
```
- GKE tu dong xoa cert cu va tao cert moi khi them domain
- CA HAI domain chuyen ve "Provisioning" (keycloak tam thoi mat SSL)
- Thoi gian re-provision: ~15-60 phut

**24o. Setup DNS tai matbao.net:**
```
Type: A
Host: api
Value: 34.120.179.221
TTL: 300
```
- User da them DNS truoc khi bat dau deploy

**24p. Ket qua thanh cong:**
- Backend pod: **1/1 Running**
- Logs: `Connected to MongoDB` + `Backend server running on port 3001`
- Health checks: `/api/health` tra ve **200 OK**
- SSL cert: **Provisioning** (doi 15-60 phut)
- Sau khi cert Active: **https://api.dragon-template.xyz** se hoat dong

**24q. Troubleshooting tong hop (5 loi):**

| # | Loi | Nguyen nhan | Cach fix |
|---|-----|-------------|----------|
| 1 | `command not found: kubectl` | PATH thieu `/opt/homebrew/bin` | Them vao PATH |
| 2 | `exactly one NAME is required, got 7` | Zsh split `--from-literal` vi ky tu dac biet trong MONGO_URI | Dung single quotes `--from-literal='KEY=VALUE'` |
| 3 | `readlink: command not found` | PATH thieu `/usr/bin`, `/bin`, `/usr/sbin`, `/sbin` | Them day du system paths |
| 4 | Secret thieu `AI_PROVIDERS_CONFIG` | Quen them khi tao secret lan dau | Xoa va tao lai voi du 5 fields |
| 5 | `ImagePullBackOff` - platform mismatch | Build arm64 tren Mac, GKE nodes la amd64 | `docker build --platform linux/amd64` |

---

### Step 25: Deploy Frontend Service len GKE
**Muc dich**: Deploy React SPA frontend len GKE, serve boi nginx:alpine, khong can secrets (tat ca env vars la public URLs baked tai build time).

**25a. Phan tich frontend codebase:**
- Framework: **React 19 + Vite 7** (SPA - Single Page Application)
- Production: **nginx:alpine** serve static files
- Dockerfile: 3-stage (dev → build → production)
- Container port: **8080** (non-root user appuser:1001)
- Env vars (VITE_*): **Tat ca public**, baked vao static JS tai `npm run build` time

| Env var | Gia tri production | Loai |
|---|---|---|
| `VITE_API_URL` | `https://api.dragon-template.xyz` | Public URL |
| `VITE_KEYCLOAK_URL` | `https://keycloak.dragon-template.xyz` | Public URL |
| `VITE_CHAT_TYPING_SPEED` | `65` | UI config (default trong code) |

**Quyet dinh thiet ke:**
| Quyet dinh | Ly do |
|---|---|
| Khong can K8s Secret | Tat ca env vars la public URLs, baked tai build time |
| Docker build args | VITE_* phai truyen qua `--build-arg` (khong phai runtime env) |
| NodePort 30020 | Tuong tu MongoDB/Keycloak/Backend, mien phi ($0) |
| Container port 8080 | nginx chay non-root (appuser uid 1001), khong the bind port 80 |
| Lightweight resources | nginx chi serve static files: CPU 50m-200m, Memory 64Mi-128Mi |

**25b. Fix bug nginx.conf — listen port:**
```
# TRUOC (BUG): non-root user khong the bind port 80
listen 80;

# SAU (FIX): khop voi EXPOSE 8080 trong Dockerfile
listen 8080;
```
- **Van de**: `frontend/nginx.conf` co `listen 80` nhung Dockerfile chay voi USER appuser (non-root, uid 1001)
- Non-root users KHONG the bind ports < 1024
- **Fix**: Doi `listen 80` → `listen 8080` de khop voi `EXPOSE 8080` trong Dockerfile

**25c. Update Dockerfile — them build args cho VITE_* env vars:**
```dockerfile
# Them vao build stage, TRUOC `RUN npm run build`:
ARG VITE_API_URL=http://localhost:3001
ARG VITE_KEYCLOAK_URL=http://localhost:8080
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL
```
- `ARG` nhan gia tri tu `--build-arg` khi build Docker image
- `ENV` truyen ARG vao environment de Vite doc duoc khi `npm run build`
- Default values (`localhost`) dam bao local dev van hoat dong khi build khong co args

**25d. Tao folder va files K8s:**
```
infra/gke/frontend/
├── deployment.yaml     # Frontend Deployment (nginx:alpine, port 8080)
└── service.yaml        # NodePort Service (8080 -> 30020)
```

**Cau hinh deployment:**
- Image: `asia-southeast1-docker.pkg.dev/fair-backbone-479312-h7/dragon-images/frontend:latest`
- Container port: 8080
- Khong co env vars (tat ca da baked vao static files)
- Resources: CPU request 50m/limit 200m, Memory request 64Mi/limit 128Mi
- Liveness probe: HTTP GET `/` port 8080, initialDelaySeconds 10s
- Readiness probe: HTTP GET `/` port 8080, initialDelaySeconds 5s
- Strategy: Recreate (chi 1 replica)

**25e. Cap nhat Ingress cho dragon-template.xyz:**

Cap nhat `infra/gke/ingress/managed-cert.yaml` — them domain:
```yaml
spec:
  domains:
    - dragon-template.xyz              # Them moi
    - keycloak.dragon-template.xyz
    - api.dragon-template.xyz
```

Cap nhat `infra/gke/ingress/ingress.yaml` — them rule + doi defaultBackend:
```yaml
spec:
  defaultBackend:
    service:
      name: frontend           # Doi tu keycloak sang frontend
      port:
        number: 8080
  rules:
    - host: dragon-template.xyz        # Them moi
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend
                port:
                  number: 8080
    - host: keycloak.dragon-template.xyz
      ...
    - host: api.dragon-template.xyz
      ...
```

**25f. Them job `deploy-frontend` vao `deploy-gke.yml`:**
- Them `frontend/**` vao workflow paths trigger
- Trigger: thay doi trong `frontend/` hoac `infra/gke/frontend/`
- Steps:
  1. Auth GCP (Workload Identity Federation)
  2. Configure Docker for Artifact Registry
  3. Build & push Docker image voi build args:
     ```bash
     docker build \
       --build-arg VITE_API_URL=https://api.dragon-template.xyz \
       --build-arg VITE_KEYCLOAK_URL=https://keycloak.dragon-template.xyz \
       -t .../frontend:${{ github.sha }} \
       -t .../frontend:latest \
       --target production \
       ./frontend
     ```
  4. Get GKE credentials
  5. Create namespace (idempotent)
  6. Deploy manifests (`kubectl apply -f infra/gke/frontend/`)
  7. Wait for rollout (120s)
  8. Show status
- **Khong co step "Create Secret"** vi frontend khong can secrets

**25g. Configure Docker for Artifact Registry:**
```bash
gcloud auth configure-docker asia-southeast1-docker.pkg.dev --quiet
# => gcloud credential helpers already registered correctly.
```

**25h. Build & push Docker image (THANH CONG ngay lan dau):**
```bash
docker build --platform linux/amd64 \
  --build-arg VITE_API_URL=https://api.dragon-template.xyz \
  --build-arg VITE_KEYCLOAK_URL=https://keycloak.dragon-template.xyz \
  --target production \
  -t asia-southeast1-docker.pkg.dev/fair-backbone-479312-h7/dragon-images/frontend:latest \
  ./frontend
# => ✓ 4102 modules transformed
# => dist/index.html                     0.71 kB
# => dist/assets/index-a0fu9h84.css     11.67 kB
# => dist/assets/index-Dn905Y3-.js   1,598.37 kB (gzip: 534.64 kB)
# => ✓ built in 20.82s

docker push asia-southeast1-docker.pkg.dev/fair-backbone-479312-h7/dragon-images/frontend:latest
# => latest: digest: sha256:02f12eb2ff60... size: 856
```
- Da hoc tu Step 24: dung `--platform linux/amd64` ngay tu dau (Mac Apple Silicon)
- Vite build warning: chunk > 500kB (co the code-split sau, khong urgent)

**25i. Deploy frontend K8s manifests:**
```bash
kubectl apply -f infra/gke/frontend/
# => deployment.apps/frontend created
# => service/frontend created
```

**25j. Apply updated Ingress + ManagedCertificate:**
```bash
kubectl apply -f infra/gke/ingress/
# => ingress.networking.k8s.io/dragon-ingress configured
# => managedcertificate.networking.gke.io/dragon-cert configured
```

**25k. Wait for rollout — THANH CONG:**
```bash
kubectl rollout status deployment/frontend -n dragon --timeout=120s
# => deployment "frontend" successfully rolled out
```

**25l. Verify tat ca services:**
```bash
kubectl get pods -n dragon
# NAME                        READY   STATUS    RESTARTS       AGE
# backend-769c6b584d-vk2ks    1/1     Running   4 (4m ago)     48m
# frontend-57fc94657f-lspfs   1/1     Running   0              26s
# keycloak-854c5cb8cb-24s8m   1/1     Running   0              5h47m
# mongodb-0                   1/1     Running   0              6h48m

kubectl get svc -n dragon
# NAME       TYPE       CLUSTER-IP    PORT(S)
# backend    NodePort   10.2.5.237    3001:30010/TCP
# frontend   NodePort   10.2.5.74     8080:30020/TCP
# keycloak   NodePort   10.2.6.28     8080:30080/TCP
# mongodb    NodePort   10.2.15.193   27017:30017/TCP

kubectl get ingress -n dragon
# NAME             HOSTS                                                                      ADDRESS          PORTS
# dragon-ingress   dragon-template.xyz,keycloak.dragon-template.xyz,api.dragon-template.xyz   34.120.179.221   80
```

**25m. GCE Backend registration — mat ~1 phut:**
```bash
# Ngay sau deploy, backends chi co backend + keycloak:
kubectl describe ingress dragon-ingress -n dragon
# ingress.kubernetes.io/backends:
#   {"k8s1-...-backend-3001-...":"HEALTHY","k8s1-...-keycloak-8080-...":"HEALTHY"}
# => THIEU frontend!

# Trong thoi gian nay, request toi dragon-template.xyz bi route sai sang Keycloak:
curl -sk https://dragon-template.xyz/
# => 302 redirect to /admin/ (Keycloak behavior)

# Sau ~1 phut, frontend backend duoc them:
# ingress.kubernetes.io/backends:
#   {"...-backend-3001-...":"HEALTHY","...-frontend-8080-...":"HEALTHY","...-keycloak-8080-...":"HEALTHY"}
```
- GCE Ingress controller can ~1 phut de tao backend va health check cho service moi
- Trong thoi gian nay, traffic bi route qua defaultBackend cu (hoac Keycloak)
- **Sau khi backend HEALTHY**: frontend hoat dong binh thuong

**25n. Test frontend response:**
```bash
curl -sk https://dragon-template.xyz/ | head -5
# <!doctype html>
# <html lang="en">
# <head>
#   <meta charset="UTF-8" />
#   <link rel="icon" type="image/svg+xml" href="/vite.svg" />
```
- Frontend tra ve HTML cua React SPA ✓
- Vite assets loaded: `index-Dn905Y3-.js`, `index-a0fu9h84.css` ✓

**25o. ManagedCertificate — SSL re-provisioning cho dragon-template.xyz:**
```bash
kubectl describe managedcertificate dragon-cert -n dragon
# Status:
#   Certificate Status: Active
#   Domain Status:
#     Domain: api.dragon-template.xyz       Status: Active
#     Domain: keycloak.dragon-template.xyz   Status: Active
#     # dragon-template.xyz CHUA co trong domain status (dang provision)
# Events:
#   Warning  BackendError  resourceInUseByAnotherResource
#   Normal   Delete        Delete SslCertificate mcrt-228c3ba1-...
#   Normal   Create        Create SslCertificate mcrt-228c3ba1-...
```
- GKE tu dong xoa cert cu va tao cert moi khi them domain (giong Step 24n)
- Cert cu (keycloak + api) van Active, cert moi can provision cho dragon-template.xyz
- `BackendError: resourceInUseByAnotherResource` la transient — GKE tu resolve
- Thoi gian: **~15-60 phut**

**SSL check (cert chua provision):**
```bash
curl -sv https://dragon-template.xyz/ 2>&1 | head -20
# * LibreSSL SSL_connect: SSL_ERROR_SYSCALL
# => SSL handshake fail vi cert chua cover dragon-template.xyz

curl -sk https://dragon-template.xyz/ 2>&1 | head -5
# <!doctype html>
# => Voi -k (skip verify) thi van tra ve HTML (backend dang hoat dong)
```
- Sau khi cert provision xong, HTTPS se hoat dong binh thuong khong can `-k`

**25p. Setup DNS tai matbao.net:**
```
Type: A
Host: @          (hoac de trong)
Value: 34.120.179.221
TTL: 300
```
- User da them DNS truoc khi bat dau deploy

**25q. Ket qua thanh cong:**
- Frontend pod: **1/1 Running**
- GCE Backend: **HEALTHY**
- `curl -sk https://dragon-template.xyz/` tra ve React SPA HTML ✓
- SSL cert: **Provisioning** (doi 15-60 phut cho domain dragon-template.xyz)
- Sau khi cert Active: **https://dragon-template.xyz** se hoat dong day du

**25r. Troubleshooting tong hop (2 van de):**

| # | Van de | Nguyen nhan | Cach fix |
|---|--------|-------------|----------|
| 1 | Traffic route sai sang Keycloak (302 → /admin/) | GCE Ingress chua register frontend backend (~1 phut) | Doi ~1 phut de GCE tao backend + health check |
| 2 | SSL handshake fail cho dragon-template.xyz | ManagedCertificate dang re-provision | Doi 15-60 phut, dung `-sk` de test truoc |

---

### Step 26: Setup Google Cloud Storage (GCS) cho file upload
**Muc dich**: Tao GCS bucket de luu tru file upload (avatar, attachments, etc.) va service account de truy cap tu backend.

**26a. Tao GCS bucket:**
```bash
gcloud storage buckets create gs://dragon-template-storage \
  --project=fair-backbone-479312-h7 \
  --location=asia-southeast1 \
  --uniform-bucket-level-access \
  --public-access-prevention
# => Creating gs://dragon-template-storage/...
```
- **Location**: `asia-southeast1` (cung region voi GKE cluster)
- **Uniform bucket-level access**: Don gian hoa IAM, khong dung ACL per-object
- **Public access prevention**: Chan truy cap public, chi cho phep qua service account

**26b. Verify bucket da tao:**
```bash
gcloud storage buckets describe gs://dragon-template-storage --format="json(name,location,iamConfiguration)"
# => {
#   "iamConfiguration": {
#     "publicAccessPrevention": "enforced",
#     "uniformBucketLevelAccess": { "enabled": true }
#   },
#   "location": "ASIA-SOUTHEAST1",
#   "name": "dragon-template-storage"
# }
```

**26c. Tao dedicated service account cho GCS:**
```bash
gcloud iam service-accounts create dragon-storage \
  --display-name="Dragon GCS Storage" \
  --project=fair-backbone-479312-h7
# => Created service account [dragon-storage].
```
- Tao rieng service account `dragon-storage` (khong dung chung `dragon-deployer` cua CI/CD)
- Separation of concerns: CI/CD deployer chi can deploy, storage SA chi can read/write objects

**26d. Grant `roles/storage.objectAdmin` cho service account tren bucket:**
```bash
gcloud storage buckets add-iam-policy-binding gs://dragon-template-storage \
  --member="serviceAccount:dragon-storage@fair-backbone-479312-h7.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
# => Updated IAM policy for bucket [dragon-template-storage].
# => bindings:
# => - members:
# =>   - serviceAccount:dragon-storage@fair-backbone-479312-h7.iam.gserviceaccount.com
# =>   role: roles/storage.objectAdmin
```
- `roles/storage.objectAdmin`: Quyen create, read, update, delete objects trong bucket
- Chi bind tren bucket nay, khong phai project-level (least privilege)

**26e. Tao JSON key cho service account:**
```bash
gcloud iam service-accounts keys create /tmp/dragon-storage-key.json \
  --iam-account=dragon-storage@fair-backbone-479312-h7.iam.gserviceaccount.com \
  --project=fair-backbone-479312-h7
# => created key [<KEY_ID>] for [dragon-storage@...iam.gserviceaccount.com]
```
- Key ID: xem trong `secret.md`
- Key file luu tai `/tmp/dragon-storage-key.json` (da copy vao `secret.md` va xoa file tmp)

**26f. Cap nhat secret.md:**
- Them section "GCS (Google Cloud Storage)" vao `secret.md` voi:
  - Bucket name, location, service account email
  - Full JSON key (private key)
  - Usage example voi `@google-cloud/storage`
- Them `GCS_CREDENTIALS` vao bang GitHub Secrets

**26g. Usage trong code (Node.js):**
```javascript
const { Storage } = require('@google-cloud/storage');
const storage = new Storage({
  projectId: 'fair-backbone-479312-h7',
  credentials: JSON.parse(process.env.GCS_CREDENTIALS)
});
const bucket = storage.bucket('dragon-template-storage');

// Upload file
await bucket.upload(localFilePath, { destination: 'uploads/file.png' });

// Generate signed URL (tam thoi, co thoi han)
const [url] = await bucket.file('uploads/file.png').getSignedUrl({
  action: 'read',
  expires: Date.now() + 15 * 60 * 1000 // 15 phut
});
```

**26h. Ket qua:**
- GCS bucket: **dragon-template-storage** (asia-southeast1) ✓
- Service account: **dragon-storage@fair-backbone-479312-h7.iam.gserviceaccount.com** ✓
- IAM role: **roles/storage.objectAdmin** (bucket-level) ✓
- JSON key: Da luu vao `secret.md` ✓
- Public access: **Blocked** (enforced) ✓
- Uniform bucket-level access: **Enabled** ✓

---

### Step 27: Add GCS_CREDENTIALS to Backend Deployment
**Muc dich**: Backend upload API (`POST /api/upload`) tra ve 500 vi thieu env var `GCS_CREDENTIALS`. Can them vao K8s secret, deployment manifest, va GitHub Secrets.

**27a. Chan doan loi:**
```bash
# Check backend pod logs
kubectl logs deployment/backend -n dragon --tail=100

# Tim thay loi:
# [Upload] GCS upload error: GCS_CREDENTIALS env var is required. Set it to the full JSON service account key.
# POST /api/upload 500
```

**27b. Them GCS_CREDENTIALS vao backend deployment.yaml:**
```yaml
# infra/gke/backend/deployment.yaml - them env var moi:
            - name: GCS_CREDENTIALS
              valueFrom:
                secretKeyRef:
                  name: backend-secret
                  key: GCS_CREDENTIALS
```

**27c. Them GCS_CREDENTIALS vao deploy-gke.yml (CI/CD):**
```yaml
# .github/workflows/deploy-gke.yml - them vao buoc "Create Backend secret":
            --from-literal=GCS_CREDENTIALS='${{ secrets.GCS_CREDENTIALS }}' \
```

**27d. Patch K8s secret truc tiep (fix ngay, khong doi CI/CD):**
```bash
# QUAN TRONG: Phai dung heredoc voi 'ENDOFFILE' (co quotes) de giu literal \n trong private_key
# Neu dung echo/bash truc tiep, \n se bi convert thanh newline that -> JSON.parse() loi:
# "Bad control character in string literal in JSON at position 167"

cat > /tmp/gcs-creds.json << 'ENDOFFILE'
{"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\nMII...\n-----END PRIVATE KEY-----\n",...}
ENDOFFILE

# Verify JSON hop le truoc khi apply
node -e "JSON.parse(require('fs').readFileSync('/tmp/gcs-creds.json','utf8')); console.log('JSON valid!')"

# Base64 encode va patch secret
GCS_B64=$(base64 < /tmp/gcs-creds.json | tr -d '\n')
kubectl patch secret backend-secret -n dragon \
  --type='json' \
  -p="[{\"op\":\"add\",\"path\":\"/data/GCS_CREDENTIALS\",\"value\":\"$GCS_B64\"}]"
```

**27e. Apply deployment va restart backend:**
```bash
kubectl apply -f infra/gke/backend/deployment.yaml
kubectl rollout restart deployment/backend -n dragon
kubectl rollout status deployment/backend -n dragon --timeout=120s
```

**27f. Them GitHub Secret (cho CI/CD deploy sau nay):**
```bash
# Set GCS_CREDENTIALS secret (full JSON service account key)
gh secret set GCS_CREDENTIALS --repo dongitran/Dragon-Template-AI --body '<xem trong secret.md>'

# Verify
gh secret list --repo dongitran/Dragon-Template-AI | grep GCS
```

**27g. Verify upload API hoat dong:**
```bash
# Check logs - khong con loi GCS
kubectl logs deployment/backend -n dragon --tail=20

# Test upload API
curl -X POST https://api.dragon-template.xyz/api/upload \
  -H "Cookie: token=<jwt_token>" \
  -F "file=@test-file.pdf"
```

**27h. Luu y quan trong:**
- **Private key `\n` trong JSON**: Khi truyen JSON qua bash/shell, `\n` trong `private_key` bi convert thanh newline that. Phai dung heredoc voi quotes (`<< 'EOF'`) hoac ghi ra file truoc de giu nguyen literal `\n`.
- **Loi "Bad control character"**: La do `JSON.parse()` gap actual newline trong string (khong hop le trong JSON). Fix: dam bao `\n` la escape sequence, khong phai newline that.

**27i. Ket qua:**
- Backend pod co env var `GCS_CREDENTIALS` ✓
- Upload API (`POST /api/upload`) tra ve 200 ✓
- K8s secret `backend-secret` co key `GCS_CREDENTIALS` ✓
- GitHub Secret `GCS_CREDENTIALS` da set ✓
- CI/CD (`deploy-gke.yml`) se tu dong apply secret khi deploy ✓

---

## Ket qua cuoi cung (Updated)

### MongoDB on GKE
| Property | Value |
|----------|-------|
| Pod | mongodb-0 (StatefulSet) |
| Image | mongo:7 |
| Namespace | dragon |
| PVC | 3GB pd-standard |
| Service | NodePort 30017 |
| Node IPs | 34.158.41.47, 34.87.99.143 |
| CPU | request 100m, limit 500m |
| Memory | request 256Mi, limit 512Mi |

### Keycloak on GKE
| Property | Value |
|----------|-------|
| Pod | keycloak-* (Deployment) |
| Image | quay.io/keycloak/keycloak:24.0 |
| Mode | start-dev (H2 embedded DB) |
| Namespace | dragon |
| PVC | 1GB pd-standard |
| Service | NodePort 30080 |
| Domain | https://keycloak.dragon-template.xyz |
| Admin Console (NodePort) | http://34.158.41.47:30080 |
| CPU | request 100m, limit 500m |
| Memory | request 512Mi, limit 1Gi |

### Backend on GKE
| Property | Value |
|----------|-------|
| Pod | backend-* (Deployment) |
| Image | asia-southeast1-docker.pkg.dev/.../dragon-images/backend:latest |
| Namespace | dragon |
| Service | NodePort 30010 |
| Domain | https://api.dragon-template.xyz |
| CPU | request 100m, limit 500m |
| Memory | request 256Mi, limit 512Mi |
| Health check | /api/health (liveness 30s, readiness 10s) |
| Env (direct) | BACKEND_PORT, NODE_ENV, KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID |
| Env (secret) | MONGO_URI, KEYCLOAK_CLIENT_SECRET, GEMINI_API_KEYS, AI_PROVIDERS_CONFIG, CORS_ORIGIN, GCS_CREDENTIALS |

### Frontend on GKE
| Property | Value |
|----------|-------|
| Pod | frontend-* (Deployment) |
| Image | asia-southeast1-docker.pkg.dev/.../dragon-images/frontend:latest |
| Namespace | dragon |
| Service | NodePort 30020 |
| Domain | https://dragon-template.xyz |
| Container port | 8080 (nginx:alpine, non-root user) |
| CPU | request 50m, limit 200m |
| Memory | request 64Mi, limit 128Mi |
| Health check | / (liveness 10s, readiness 5s) |
| Env vars | None (all VITE_* baked at Docker build time) |
| Build args | VITE_API_URL, VITE_KEYCLOAK_URL |

### GCS (Google Cloud Storage)
| Property | Value |
|----------|-------|
| Bucket | dragon-template-storage |
| Location | asia-southeast1 |
| Service Account | dragon-storage@fair-backbone-479312-h7.iam.gserviceaccount.com |
| IAM Role | roles/storage.objectAdmin (bucket-level) |
| Uniform Bucket-Level Access | Enabled |
| Public Access Prevention | Enforced |
| Key ID | Xem trong `secret.md` |
| Usage | `@google-cloud/storage` + `GCS_CREDENTIALS` env var |

### Ingress & SSL
| Property | Value |
|----------|-------|
| Domains | dragon-template.xyz, keycloak.dragon-template.xyz, api.dragon-template.xyz |
| DNS Provider | matbao.net (A records) |
| Static IP | 34.120.179.221 (dragon-ingress-ip, global) |
| Load Balancer | GCP HTTP(S) LB (auto by GKE Ingress) |
| SSL Certificate | GCP Managed Certificate (auto-renew, multi-domain) |
| Ingress Class | gce (annotation-based) |
| Chi phi | ~$18/thang |

### CI/CD Pipeline
| Component | Value |
|----------|-------|
| Workflow | `.github/workflows/deploy-gke.yml` |
| Auth | Workload Identity Federation (keyless) |
| Service Account | dragon-deployer@fair-backbone-479312-h7.iam.gserviceaccount.com |
| WIF Pool | dragon-github-pool |
| WIF Provider | dragon-github-provider |
| Docker Registry | Artifact Registry (asia-southeast1-docker.pkg.dev) |
| Workflow Triggers | `infra/gke/**`, `backend/**`, `frontend/**` |
| Jobs | deploy-mongodb, deploy-ingress, deploy-keycloak, deploy-backend, deploy-frontend |
| GitHub Secrets | MONGO_USERNAME, MONGO_PASSWORD, KEYCLOAK_ADMIN, KEYCLOAK_ADMIN_PASSWORD, MONGO_URI, KEYCLOAK_CLIENT_SECRET, GEMINI_API_KEYS, AI_PROVIDERS_CONFIG, CORS_ORIGIN, GCS_CREDENTIALS |

---

## Troubleshooting Log (Updated)

| # | Van de | Nguyen nhan | Cach fix |
|---|--------|-------------|----------|
| 9 | `Insufficient cpu` (pod Pending) | e2-medium chi co 940m allocatable, system pods chiem ~750m | Giam CPU request tu 250m xuong 100m |
| 10 | Probe timeout 1s | `mongosh` startup cham tren CPU nho | Tang `timeoutSeconds` len 10s |
| 11 | Firewall rule sai network | Tao tren `default` thay vi `dragon-network-1304a1a` | Xoa va tao lai voi `--network=dragon-network-1304a1a` |
| 12 | WIF Provider thieu attribute condition | GCP yeu cau bat buoc | Them `--attribute-condition` |
| 13 | GitHub Actions "Wait for MongoDB" timeout | Pod Pending vi CPU + probe issues | Fix CPU request va probe timeout, re-trigger |
| 14 | Keycloak `start-dev` not found | `command` ghi de ENTRYPOINT | Doi sang `args: ["start-dev"]` |
| 15 | Keycloak PVC permission denied | PVC owned by root, Keycloak chay uid 1000 | Them `securityContext.fsGroup: 1000` |
| 16 | Keycloak health endpoint 404 | Chua enable health check | Them `KC_HEALTH_ENABLED=true` |
| 17 | Keycloak liveness probe killed | start-dev build cham (~155s) vuot qua delay 180s | Tang `initialDelaySeconds` len 300s, memory len 1Gi |
| 18 | NEG sync error `RESOURCE_NOT_FOUND` | Ingress tim `default-http-backend` (khong ton tai) | Them `spec.defaultBackend` tro ve keycloak |
| 19 | `ingressClassName: gce` bi bo qua | GKE khong co IngressClass resource | Dung annotation `kubernetes.io/ingress.class: "gce"` |
| 20 | CSP error `http://https:` | `KC_HOSTNAME` co protocol `https://` | Chi dung hostname `keycloak.dragon-template.xyz` (khong co protocol) |
| 21 | "HTTPS required" khi truy cap HTTP | Keycloak reject HTTP khi KC_HOSTNAME da set | Doi GCP Managed Certificate Active (~51 phut), dung HTTPS |
| 22 | Connection reset sau khi tao Ingress | GCP LB can 2-3 phut tao forwarding rules | Doi 2-3 phut |
| 23 | `command not found: kubectl` | PATH thieu `/opt/homebrew/bin` | Them `/opt/homebrew/bin` vao PATH |
| 24 | `exactly one NAME is required, got 7` | Zsh split `--from-literal` vi ky tu dac biet (`?`, `=`, `@`) trong MONGO_URI | Dung single quotes `--from-literal='KEY=VALUE'` |
| 25 | `readlink: command not found` (gke-gcloud-auth-plugin) | PATH thieu `/usr/bin`, `/bin`, `/usr/sbin`, `/sbin` | Full PATH: `/opt/homebrew/share/google-cloud-sdk/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin` |
| 26 | K8s Secret thieu `AI_PROVIDERS_CONFIG` | Quen them khi tao secret lan dau | `kubectl delete secret` + tao lai voi du 5 fields |
| 27 | Docker image `ImagePullBackOff` - platform mismatch | Build arm64 tren Mac Apple Silicon, GKE nodes la amd64 | Rebuild voi `docker build --platform linux/amd64` |
| 28 | ManagedCertificate `resourceInUseByAnotherResource` | Them domain moi vao cert da ton tai | GKE tu dong xoa/tao lai cert, doi ~15-60 phut re-provision |
| 29 | nginx.conf `listen 80` nhung non-root user | Non-root users KHONG the bind ports < 1024 | Doi `listen 80` → `listen 8080` khop voi `EXPOSE 8080` |
| 30 | Frontend traffic route sai sang Keycloak (302 → /admin/) | GCE Ingress chua register frontend backend (~1 phut) | Doi ~1 phut de GCE tao backend + health check |
| 31 | SSL handshake fail cho dragon-template.xyz | ManagedCertificate dang re-provision sau khi them domain moi | Doi 15-60 phut, dung `curl -sk` de test truoc |

---

## Useful Commands

```bash
# Navigate to infra
cd infra

# Set PATH cho gke plugin
export PATH="/opt/homebrew/share/google-cloud-sdk/bin:$PATH"

# Preview changes
PULUMI_CONFIG_PASSPHRASE="" pulumi preview

# Deploy
PULUMI_CONFIG_PASSPHRASE="" pulumi up

# Get outputs
PULUMI_CONFIG_PASSPHRASE="" pulumi stack output

# Connect kubectl
gcloud container clusters get-credentials dragon-gke \
  --zone asia-southeast1-a --project fair-backbone-479312-h7

# Check cluster
kubectl get nodes
kubectl get pods --all-namespaces

# Check Ingress & SSL cert status
kubectl get ingress -n dragon
kubectl get managedcertificates -n dragon
kubectl describe managedcertificate dragon-cert -n dragon
kubectl get managedcertificates -n dragon -o yaml

# Backend: check logs & status
kubectl logs deployment/backend -n dragon
kubectl describe deployment backend -n dragon

# Backend: build & push Docker image (tu Mac Apple Silicon)
docker build --platform linux/amd64 \
  -t asia-southeast1-docker.pkg.dev/fair-backbone-479312-h7/dragon-images/backend:latest \
  --target production ./backend
docker push asia-southeast1-docker.pkg.dev/fair-backbone-479312-h7/dragon-images/backend:latest
kubectl rollout restart deployment/backend -n dragon

# Frontend: check logs & status
kubectl logs deployment/frontend -n dragon
kubectl describe deployment frontend -n dragon

# Frontend: build & push Docker image (tu Mac Apple Silicon)
docker build --platform linux/amd64 \
  --build-arg VITE_API_URL=https://api.dragon-template.xyz \
  --build-arg VITE_KEYCLOAK_URL=https://keycloak.dragon-template.xyz \
  -t asia-southeast1-docker.pkg.dev/fair-backbone-479312-h7/dragon-images/frontend:latest \
  --target production ./frontend
docker push asia-southeast1-docker.pkg.dev/fair-backbone-479312-h7/dragon-images/frontend:latest
kubectl rollout restart deployment/frontend -n dragon

# GCS: list objects in bucket
gcloud storage ls gs://dragon-template-storage/
gcloud storage ls gs://dragon-template-storage/uploads/

# GCS: upload/download files
gcloud storage cp local-file.png gs://dragon-template-storage/uploads/
gcloud storage cp gs://dragon-template-storage/uploads/file.png ./downloaded.png

# GCS: check bucket IAM policy
gcloud storage buckets get-iam-policy gs://dragon-template-storage

# GCS: check service account keys
gcloud iam service-accounts keys list \
  --iam-account=dragon-storage@fair-backbone-479312-h7.iam.gserviceaccount.com

# Destroy infrastructure
PULUMI_CONFIG_PASSPHRASE="" pulumi destroy
```

## Files Structure
```
infra/
├── pulumi/
│   ├── .gitignore           # Bao ve secrets khoi git
│   ├── .pulumi/             # Pulumi local state (git-ignored)
│   ├── index.ts             # Code IaC chinh (VPC + GKE)
│   ├── package.json         # Dependencies: @pulumi/pulumi, @pulumi/gcp, @pulumi/kubernetes
│   ├── package-lock.json
│   ├── Pulumi.yaml          # Project definition
│   ├── Pulumi.dev.yaml      # Stack config (gcp-project, region, zone)
│   ├── tsconfig.json        # TypeScript config
│   └── INFRASTRUCTURE.md    # File nay
├── gke/
│   ├── mongodb/
│   │   ├── namespace.yaml       # Namespace "dragon"
│   │   ├── pvc.yaml             # PVC 3GB pd-standard
│   │   ├── statefulset.yaml     # MongoDB StatefulSet (mongo:7)
│   │   └── service.yaml         # NodePort 30017
│   ├── keycloak/
│   │   ├── deployment.yaml      # Keycloak Deployment (keycloak:24.0)
│   │   ├── pvc.yaml             # PVC 1GB pd-standard
│   │   └── service.yaml         # NodePort 30080
│   ├── backend/
│   │   ├── deployment.yaml      # Backend Deployment (Express.js, Artifact Registry)
│   │   └── service.yaml         # NodePort 30010
│   ├── frontend/
│   │   ├── deployment.yaml      # Frontend Deployment (React SPA + nginx:alpine)
│   │   └── service.yaml         # NodePort 30020
│   └── ingress/
│       ├── managed-cert.yaml    # GCP Managed Certificate (auto SSL, 3 domains)
│       └── ingress.yaml         # GKE Ingress (HTTP(S) LB, 3 host rules)
└── .github/workflows/
    └── deploy-gke.yml           # CI/CD: deploy-mongodb, deploy-ingress, deploy-keycloak, deploy-backend, deploy-frontend
```
