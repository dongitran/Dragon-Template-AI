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
└── VPC: dragon-network (custom, no auto-subnets)
    ├── Firewall: allow-mongodb-nodeport (tcp:30017)
    └── Subnet: dragon-subnet (10.0.0.0/24)
        ├── Secondary Range "pods": 10.1.0.0/16
        └── Secondary Range "services": 10.2.0.0/20
            └── GKE Cluster: dragon-gke (zonal)
                └── Node Pool: dragon-nodes (custom, managed by Pulumi)
                    ├── Node 1: e2-medium, 50GB (34.158.41.47)
                    └── Node 2: e2-medium, 50GB (34.87.99.143)
                        └── Namespace: dragon
                            ├── StatefulSet: mongodb (mongo:7, 1/1 Running)
                            ├── Service: mongodb (NodePort 30017)
                            ├── PVC: mongodb-data (3GB pd-standard)
                            └── Secret: mongodb-secret
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

### CI/CD Pipeline
| Component | Value |
|----------|-------|
| Workflow | `.github/workflows/deploy-gke.yml` |
| Auth | Workload Identity Federation (keyless) |
| Service Account | dragon-deployer@fair-backbone-479312-h7.iam.gserviceaccount.com |
| WIF Pool | dragon-github-pool |
| WIF Provider | dragon-github-provider |
| GitHub Secrets | MONGO_USERNAME, MONGO_PASSWORD |

---

## Troubleshooting Log (Updated)

| # | Van de | Nguyen nhan | Cach fix |
|---|--------|-------------|----------|
| 9 | `Insufficient cpu` (pod Pending) | e2-medium chi co 940m allocatable, system pods chiem ~750m | Giam CPU request tu 250m xuong 100m |
| 10 | Probe timeout 1s | `mongosh` startup cham tren CPU nho | Tang `timeoutSeconds` len 10s |
| 11 | Firewall rule sai network | Tao tren `default` thay vi `dragon-network-1304a1a` | Xoa va tao lai voi `--network=dragon-network-1304a1a` |
| 12 | WIF Provider thieu attribute condition | GCP yeu cau bat buoc | Them `--attribute-condition` |
| 13 | GitHub Actions "Wait for MongoDB" timeout | Pod Pending vi CPU + probe issues | Fix CPU request va probe timeout, re-trigger |

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

# Destroy infrastructure
PULUMI_CONFIG_PASSPHRASE="" pulumi destroy
```

## Files Structure
```
infra/
├── .gitignore           # Bao ve secrets khoi git
├── .pulumi/             # Pulumi local state (git-ignored)
├── index.ts             # Code IaC chinh (VPC + GKE)
├── package.json         # Dependencies: @pulumi/pulumi, @pulumi/gcp, @pulumi/kubernetes
├── package-lock.json
├── Pulumi.yaml          # Project definition
├── Pulumi.dev.yaml      # Stack config (gcp-project, region, zone)
├── tsconfig.json        # TypeScript config
└── INFRASTRUCTURE.md    # File nay
```
