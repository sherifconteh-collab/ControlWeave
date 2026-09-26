# File Storage

ControlWeave stores uploaded files (evidence, evidence versions, policy documents, scan imports, and evidence collected from Splunk, GitHub and automation rules) in one uploads directory. Where that directory lives decides whether the files survive a redeploy.

On Railway, and on any container platform, the container filesystem is **reset on every deploy**. Pick one of the two durable options below before you upload real evidence.

## Option 1: object storage (recommended for SaaS and multi-replica)

Set `S3_BUCKET` and the backend switches to the S3 driver automatically. Every upload is written locally, then persisted to the bucket before the request succeeds. If the bucket write fails, the upload is rejected with HTTP 503 and nothing is recorded, so a record never points at a file that exists only on a disposable disk. A file missing locally (after a redeploy, or on another replica) is fetched back from the bucket the first time it is read.

| Variable | Default | Purpose |
|---|---|---|
| `S3_BUCKET` | (unset) | Bucket name. Setting it enables the S3 driver. |
| `STORAGE_DRIVER` | `s3` when `S3_BUCKET` is set, else `local` | Force a driver. |
| `S3_REGION` | `AWS_REGION` or `us-east-1` | Bucket region. |
| `S3_ENDPOINT` | AWS | Endpoint for S3-compatible stores (Cloudflare R2, MinIO, Backblaze B2, Wasabi). |
| `S3_FORCE_PATH_STYLE` | `false` | Set `true` for MinIO and most self-hosted stores. |
| `S3_PREFIX` | `uploads/` | Key prefix inside the bucket. |
| `S3_SSE` | `AES256` | Server-side encryption: `AES256`, `aws:kms`, or `none` (for stores that reject the header). |
| `S3_KMS_KEY_ID` | (unset) | KMS key when `S3_SSE=aws:kms`. |

Credentials come from the standard AWS chain: `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, or an instance or task role.

Recommended bucket settings: block all public access, enable versioning (evidence is audit material), and for regulated customers add Object Lock in governance mode with a retention period matching your evidence retention policy. Grant the application only `s3:PutObject`, `s3:GetObject` and `s3:DeleteObject` on `arn:aws:s3:::<bucket>/<prefix>*`.

### Moving existing files into the bucket

After switching an existing install to the S3 driver, upload the files already on disk once, before the next redeploy:

```bash
cd controlweave/backend
npm run storage:sync -- --dry-run   # list what would be uploaded
npm run storage:sync                # upload
```

## Option 2: a persistent volume (single instance, self-hosted)

Mount a volume and point `UPLOADS_DIR` at it. On Railway, add a volume to the backend service (for example mounted at `/data`) and set `UPLOADS_DIR=/data/uploads`. The backend detects `RAILWAY_VOLUME_MOUNT_PATH` and treats the directory as durable.

On other self-hosted installs (Docker volume, NFS, a VM disk that is backed up), set `STORAGE_LOCAL_DURABLE=true` once `UPLOADS_DIR` is on durable disk. This only affects the startup warning and the QA self-test result; it does not change behavior.

Existing evidence records keep working after `UPLOADS_DIR` moves: stored paths are mapped onto the current directory by the part after `/uploads/`, so copy the old directory's contents into the new one.

## Verifying

- At startup the backend logs `storage.configured` with the driver and whether it is durable. In production it also logs `storage.ephemeral` as a warning when files would be lost on redeploy.
- **QA & Self-Test → Platform health → Evidence storage writable and durable** writes, reads back and deletes a probe file. With the S3 driver it also deletes the local copy and restores it from the bucket. It warns when storage is not durable.
- **Frameworks & compliance data → Evidence files match their recorded hashes** re-hashes recent evidence, restoring files from the bucket where needed.
