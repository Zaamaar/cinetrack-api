# CineTrack API

A movie watchlist and rating API — track what you're watching, planning to watch, and rate what you've finished.

## Stack
Node.js, Express, PostgreSQL, JWT auth, Docker. Deployed on AWS via a native CodePipeline → CodeBuild → ECR → ECS Fargate pipeline, sitting behind an Application Load Balancer.

## Endpoints
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Get JWT |
| GET | `/api/movies` | No | List movies |
| POST | `/api/movies` | Yes | Add a movie |
| GET | `/api/watchlist` | Yes | List your watchlist |
| POST | `/api/watchlist` | Yes | Add movie to watchlist |
| PATCH | `/api/watchlist/:id` | Yes | Update status/rating |
| DELETE | `/api/watchlist/:id` | Yes | Remove from watchlist |
| GET | `/health` | No | Health check |

## Run locally
```bash
cp .env.example .env
docker compose up --build
curl http://localhost:3000/health
```

## Deploy to AWS
See [AWS_SETUP.md](./AWS_SETUP.md) for the full CodePipeline/CodeBuild/ECR/ECS runbook.
