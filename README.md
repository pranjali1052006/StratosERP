# StratosERP

> Institutional Educational ERP Platform — Phase I

A comprehensive, standalone institutional educational platform built as a **TypeScript monorepo** using npm workspaces and Turborepo.

## 📁 Project Structure

```
stratoserp/
├── apps/
│   ├── web/             → Next.js 16 frontend (React 19, Tailwind v4)
│   └── api/             → Express.js backend (Node.js, TypeScript)
├── packages/
│   ├── database/        → Prisma ORM schema, client, and migrations
│   ├── shared/          → Shared types, constants, and utilities
│   └── eslint-config/   → Shared ESLint configuration
├── Database/            → SQL schema and migration files
├── Docs/                → Role-specific documentation
├── Phase-I/             → Phase specification documents
├── turbo.json           → Turborepo pipeline configuration
├── tsconfig.base.json   → Shared TypeScript base config
└── package.json         → Root workspace configuration
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 10.0.0
- **MySQL** 8.0+
- **MinIO** (optional, for file storage)

### Installation

```bash
# Clone the repo
git clone https://github.com/rishit1769/stratoserp.git
cd stratoserp

# Install all dependencies (hoisted to root)
npm install
```

### Environment Setup

```bash
# Copy env templates
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Edit `apps/api/.env` — set `DATABASE_URL` to your MySQL connection string:
```
DATABASE_URL="mysql://root:password@localhost:3306/StratosERP"
```

### Database Setup (Prisma)

```bash
# Push schema to your MySQL database
npm run db:push --workspace=@stratoserp/database

# Generate Prisma client (auto-runs on install)
npm run db:generate --workspace=@stratoserp/database

# Open Prisma Studio (visual DB browser)
npm run db:studio --workspace=@stratoserp/database
```

### Development

```bash
# Run all apps in parallel (web + api)
npm run dev

# Run only the frontend
npm run dev:web

# Run only the backend
npm run dev:api
```

### Build

```bash
# Build all packages and apps
npm run build

# Build specific apps
npm run build:web
npm run build:api
```

### Other Commands

```bash
# Lint all packages
npm run lint

# Type-check all packages
npm run typecheck

# Format code with Prettier
npm run format

# Clean build artifacts
npm run clean
```

## 🏗️ Tech Stack

| Layer         | Technology                         |
| ------------- | ---------------------------------- |
| Frontend      | Next.js 16, React 19, Tailwind v4  |
| Backend       | Node.js, Express, TypeScript       |
| ORM           | Prisma (type-safe database client) |
| Database      | MySQL 8.0+                         |
| Object Storage| MinIO (S3-compatible)              |
| AI/ML         | Google Gemini API                   |
| Monorepo      | npm Workspaces + Turborepo         |

## 👥 Stakeholders

- **Development**: Rishit Singh, Pranjali Khade
- **Mentorship**: Mr. Loukik Salvi