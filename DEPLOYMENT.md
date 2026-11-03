# Deploy WealthOS on a Docker server

## 1. Server prerequisites

- Ubuntu 22.04 or newer
- Docker Engine and Docker Compose plugin
- DNS records for `partner.example.com`, `app.example.com`, and `api.example.com`

## 2. Configure production environment

Copy `.env.production.example` to `.env.production` and replace every placeholder.

Generate secrets:

```sh
openssl rand -base64 48
openssl rand -base64 48
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 3. Configure domains in Nginx

Update `deployment/nginx/conf.d/wealthos.conf` with the three DNS hostnames and HTTPS server blocks. The supplied file provides HTTP and certificate challenge routing only.

## 4. Build and start

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Database migrations run automatically before the API starts.

## 5. Verify

```sh
curl -fsS https://api.example.com/api/v1/health
curl -I https://partner.example.com
curl -I https://app.example.com
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 backend-api
```
