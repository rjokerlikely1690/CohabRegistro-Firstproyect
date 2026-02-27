# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

COHAB BJJ is a student registration and payment management system for a Brazilian Jiu-Jitsu academy. It consists of:

- **Backend API** (`mongodb-api/`): Node.js/Express REST API on port 3000 with JWT auth, student CRUD, payment validation, QR generation.
- **Static frontend** (repo root): Plain HTML/CSS/JS, no build step. Serve with any static file server on port 8080.

### Services

| Service | How to run |
|---|---|
| MongoDB | `sudo dockerd &>/dev/null &` then `sudo docker start mongo` (container already created with TLS) |
| Backend API | `cd mongodb-api && NODE_TLS_REJECT_UNAUTHORIZED=0 npm run dev` (uses nodemon, port 3000) |
| Frontend | `npx serve -l 8080 .` from repo root (port 8080) |

### MongoDB setup (non-obvious)

The backend code hardcodes `tls: true` in the MongoDB client options. A local MongoDB instance **must** be configured with TLS. The Docker container `mongo` is pre-configured with a self-signed certificate at `/tmp/mongo-tls/`. If the container is missing, recreate it:

```bash
# Generate self-signed cert (if /tmp/mongo-tls doesn't exist)
mkdir -p /tmp/mongo-tls && cd /tmp/mongo-tls
cat > openssl.cnf << 'EOF'
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req
[dn]
CN = localhost
[v3_req]
subjectAltName = @alt_names
basicConstraints = CA:TRUE
[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF
openssl req -x509 -newkey rsa:2048 -keyout mongo2.key -out mongo2.crt -days 365 -nodes -config openssl.cnf
cat mongo2.key mongo2.crt > mongo2.pem && chmod 644 mongo2.pem mongo2.crt

# Run MongoDB with TLS
sudo docker run -d --name mongo -p 27017:27017 \
  -v /tmp/mongo-tls/mongo2.pem:/etc/ssl/mongo.pem:ro \
  -v /tmp/mongo-tls/mongo2.crt:/etc/ssl/mongo-ca.crt:ro \
  mongo:7 --tlsMode requireTLS --tlsCertificateKeyFile /etc/ssl/mongo.pem \
  --tlsCAFile /etc/ssl/mongo-ca.crt --tlsAllowConnectionsWithoutCertificates
```

### Backend .env file

Create `mongodb-api/.env` (gitignored) with:

```
MONGODB_URI=mongodb://127.0.0.1:27017/cohab?directConnection=true
DB_NAME=cohab
PORT=3000
JWT_SECRET=cohab-dev-secret-key-2024
EMAIL_ENABLED=false
PUBLIC_BASE_URL=http://localhost:8080/
NODE_TLS_REJECT_UNAUTHORIZED=0
```

### Admin credentials (seeded)

- Email: `admin@cohab.cl`
- Password: `Admin123!`
- Seed command: `cd mongodb-api && NODE_TLS_REJECT_UNAUTHORIZED=0 MONGODB_URI="mongodb://127.0.0.1:27017/cohab?directConnection=true" node scripts/seed-admin.js`

### Important caveats

- The `serve` package redirects `.html` extensions to clean URLs (e.g., `/login.html` -> `/login`). Use `-L` with curl.
- No linter or test framework is configured in this project. There are no `lint` or `test` npm scripts.
- The frontend config (`js/cohab-config.js`) already points to `http://localhost:3000` for local development.
- `NODE_TLS_REJECT_UNAUTHORIZED=0` is required when running the backend against local MongoDB with a self-signed cert.
- The backend starts in "degraded mode" if MongoDB is unavailable (health endpoint works, but data endpoints fail).
