# Technical Architecture Specification

## AI-Assisted Operational Memory System (MVP)

---

# 1. Overview

The system is a lightweight AI-powered operational assistant for volunteer organizations.

Primary architecture goals:

* simple deployment
* minimal infrastructure
* human-editable knowledge
* local-first documentation
* AI-assisted troubleshooting
* low operational complexity

The system uses:

* Markdown files for documentation
* filesystem-based storage
* lightweight JSON metadata database
* React frontend
* Node.js/Express backend
* Kiro CLI server mode for AI orchestration

---

# 2. High-Level Architecture

```text
Frontend (React)
    ↓
Node.js Express API
    ↓
Kiro CLI Server
    ↓
Filesystem Knowledge Base
    ├─ Markdown docs
    ├─ Incident playbooks
    ├─ Metadata JSON
    └─ Uploaded assets
```

---

# 3. Frontend Stack

## Framework

* React
* Vite

---

## UI

* TailwindCSS
* shadcn/ui (recommended)

---

## Core Screens

### 3.1 Main Incident Screen

Layout:

* left sidebar
* central conversational interface
* incident response area

Main prompt:

> “Vad krånglar just nu?”

---

### 3.2 Documentation Browser

Features:

* folder navigation
* markdown preview
* search
* category filtering

---

### 3.3 Admin Editor

Features:

* markdown editing
* metadata editing
* incident tagging
* preview mode

---

### 3.4 Incident History

Features:

* previous incidents
* successful resolutions
* unresolved incidents
* search/filtering

---

# 4. Backend Stack

## Runtime

* Node.js

---

## API Server

* Express.js

---

## AI Layer

* Kiro CLI in server mode

Kiro responsibilities:

* retrieval orchestration
* document context assembly
* AI reasoning
* structured troubleshooting generation

---

# 5. Storage Architecture

## 5.1 Documentation Storage

Filesystem-based Markdown storage.

Example structure:

```text
/docs
    /audio
        pastor-mic.md
        mixer-routing.md

    /livestream
        obs-issues.md
        stream-checklist.md

    /projection
        projector-black-screen.md

    /setup
        guest-speaker-checklist.md
```

---

## 5.2 Metadata Database

Single lightweight JSON database:

```text
/database.json
```

Purpose:

* metadata
* tags
* relationships
* incident history
* feedback records

---

## 5.3 Example Schema

```json
{
  "documents": [
    {
      "id": "pastor-mic",
      "title": "Pastor Mic Troubleshooting",
      "path": "/docs/audio/pastor-mic.md",
      "tags": ["audio", "microphone", "wireless"],
      "updatedAt": "2026-05-17"
    }
  ],

  "incidents": [
    {
      "id": "incident-001",
      "query": "No sound from pastor mic",
      "matchedDocs": ["pastor-mic"],
      "resolved": true,
      "resolutionType": "suggested-fix-worked",
      "userFeedback": "Battery pack cable was loose",
      "timestamp": "2026-05-17T10:12:00Z"
    }
  ]
}
```

---

# 6. AI Retrieval Flow

## 6.1 Incident Flow

```text
User enters issue
        ↓
Backend searches markdown corpus
        ↓
Relevant docs selected
        ↓
Kiro receives:
- user query
- matching docs
- metadata
        ↓
Kiro generates:
- troubleshooting steps
- clarifying questions
- likely causes
- escalation path
        ↓
Response shown to user
```

---

# 7. Retrieval Strategy

## Phase 1 (MVP)

Simple retrieval:

* filename matching
* tag matching
* keyword search

No vector database initially.

---

## Phase 2

Optional additions:

* embeddings
* semantic search
* local vector index

Only if needed.

---

# 8. Markdown Format

## Example Document

```markdown
# Pastor Mic Has No Sound

## Symptoms
- no audio in speakers
- meter not moving
- livestream silent

## Checks

1. Verify microphone battery
2. Check receiver power
3. Confirm channel not muted
4. Verify correct mixer scene
5. Test backup microphone

## Escalation
Contact tech lead if unresolved.
```

---

# 9. AI Prompting Strategy

The AI should:

* prioritize retrieved documents
* avoid unsupported assumptions
* provide calm step-by-step guidance
* ask clarifying questions

The AI should NOT:

* invent procedures
* fabricate equipment details
* provide unsafe instructions

---

# 10. Feedback Loop

At end of interaction:

```text
Did this solve your problem?
[ Yes ] [ Partially ] [ No ]
```

If unresolved:

```text
What actually solved it?
```

Store:

* user correction
* alternative fix
* missing documentation hints

Future admin dashboard can suggest:

* documentation updates
* recurring incidents
* knowledge gaps

---

# 11. API Endpoints

## POST /api/incident

Input:

```json
{
  "query": "No sound from pastor mic"
}
```

Returns:

```json
{
  "response": "...",
  "matchedDocs": [],
  "confidence": 0.87
}
```

---

## POST /api/feedback

```json
{
  "incidentId": "incident-001",
  "resolved": false,
  "actualFix": "Mixer scene was wrong"
}
```

---

## GET /api/docs

Returns document metadata.

---

## GET /api/doc/:id

Returns markdown content.

---

# 12. Why Filesystem + Markdown

Advantages:

* extremely simple
* version-control friendly
* portable
* editable without special tooling
* AI-friendly
* backup-friendly

This avoids:

* CMS complexity
* database migrations
* vendor lock-in

---

# 13. Deployment Model

Single-server deployment preferred initially.

Recommended:

* Ubuntu VPS
* Docker Compose

Services:

* frontend
* express backend
* Kiro server process

No Kubernetes required.

---

# 14. MVP Constraints

The MVP intentionally avoids:

* microservices
* workflow engines
* BPMN execution
* vector infrastructure
* complex auth systems
* enterprise orchestration

Primary goal:

> operational usefulness with minimal complexity.

---

# 15. Long-Term Evolution

Possible future additions:

* semantic search
* voice mode
* mobile app
* equipment inventory
* QR-code equipment troubleshooting
* Slack/Discord integration
* AI-generated documentation suggestions
* visual workflow diagrams
* multi-organization support

---

# 16. Core Product Philosophy

The system is not intended to replace volunteers.

It acts as:

* operational memory
* guided troubleshooting assistant
* institutional knowledge preservation system

Primary value:

> helping inexperienced volunteers operate with the confidence of experienced team members.

