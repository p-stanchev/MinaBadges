# httpz Badge Kit

Local playground for Mina attestations-style badges. A Node/Express verifier issues presentation requests, a mock wallet (in the Vite demo) signs them with `mina-attestations`, and the backend verifies the resulting proofs for a catalog of badge types.

## Prerequisites

- Node.js 22+ is recommended because `mina-attestations` targets modern runtimes. The demo still installs on Node 20, but expect engine warnings.

## Backend

```
cd backend
npm install
npm run dev
```

The dev server listens on `http://localhost:4000` and exposes:

- `GET /badges` ? catalog metadata
- `POST /presentation-request` ? returns a serialized presentation request for a badge
- `POST /verify-presentation` ? verifies the returned presentation

## Frontend demo

```
cd frontend-demo
npm install
npm run dev
```

Open `http://localhost:5173`. Each badge card walks through:

1. Fetch presentation request from the backend
2. Run the mock wallet (powered by `mina-attestations` + `o1js`) to create a proof
3. Call the verifier endpoint to validate and update the UI

## Shared config

Configuration that both sides need (badge catalog, credential schema, demo keys, etc.) lives under `/shared` so you can gradually replace the mock wallet with a real one.
