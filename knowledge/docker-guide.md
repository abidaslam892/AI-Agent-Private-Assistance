# Docker Operations Guide

## Core Concepts
- **Image**: read-only layered template built from a Dockerfile. **Container**: a running instance of an image.
- **Registry**: stores images (Docker Hub, private registry, ECR, ACR).
- **Volume**: persistent storage managed by Docker. **Network**: virtual network connecting containers (bridge, host, overlay).

## Essential Commands
- `docker build -t myapp:1.0 .` builds an image from the Dockerfile in the current directory.
- `docker run -d --name myapp -p 8080:80 -e ENV=prod -v data:/var/lib/data myapp:1.0` runs a detached container with port mapping, env var and volume.
- `docker ps -a` lists containers; `docker images` lists images.
- `docker logs -f --tail 100 myapp` follows logs. `docker exec -it myapp sh` opens a shell inside the container.
- `docker stop myapp`, `docker rm myapp`, `docker rmi myapp:1.0` stop/remove container/image.
- `docker system prune -a --volumes` removes unused images, containers, networks and volumes (destructive).
- `docker inspect myapp` shows low-level JSON config; `docker stats` shows live CPU/memory usage.
- `docker tag myapp:1.0 registry.example.com/myapp:1.0` then `docker push registry.example.com/myapp:1.0` publishes an image.

## Dockerfile Best Practices
```dockerfile
FROM python:3.11-slim AS base
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
USER 1000
EXPOSE 8000
HEALTHCHECK CMD curl -f http://localhost:8000/health || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```
- Use small base images (slim, alpine, distroless) and pin versions; avoid `latest` in production.
- Order layers from least to most frequently changing so the build cache is reused (copy dependency files before source).
- Use multi-stage builds to keep compilers out of the final image.
- Run as a non-root user, add a `.dockerignore`, never bake secrets into images.
- `CMD` is the default command (overridable); `ENTRYPOINT` is the fixed executable; `COPY` is preferred over `ADD`.

## Docker Compose
```yaml
services:
  db:
    image: postgres:16
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
  api:
    build: ./api
    ports: ["8000:8000"]
    depends_on:
      db: { condition: service_healthy }
volumes:
  pgdata:
```
- `docker compose up -d --build` builds and starts; `docker compose down -v` stops and removes volumes.
- `docker compose logs -f api`, `docker compose ps`, `docker compose exec api sh`.
- Services reach each other by service name (e.g. `db:5432`) on the default network.

## Networking
- **bridge** (default): isolated network on host; publish ports with `-p host:container`.
- **host**: shares host network stack. **none**: no networking. **overlay**: multi-host (Swarm).
- Containers on a user-defined bridge resolve each other by name via embedded DNS.

## Troubleshooting
- Container exits immediately: check `docker logs`, verify CMD/ENTRYPOINT, exit code via `docker inspect --format '{{.State.ExitCode}}'` (137 = OOM killed or SIGKILL, 139 = segfault, 1 = app error).
- Port already in use: change host port mapping or stop the conflicting process.
- Permission denied on volumes: align UID/GID, or fix directory ownership.
- Out of disk space: `docker system df` then prune unused data.
- Cannot connect between containers: ensure same network and use service name, not localhost.
