.PHONY: help install backend frontend dev test lint docker-up docker-down docker-build clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## Install backend + frontend dependencies
	cd backend && python -m venv .venv && . .venv/bin/activate && pip install -r requirements-dev.txt
	cd frontend && npm install

backend: ## Run the FastAPI backend (http://localhost:8000)
	cd backend && uvicorn app.main:app --reload --port 8000

frontend: ## Run the Next.js frontend (http://localhost:3000)
	cd frontend && npm run dev

test: ## Run backend tests
	cd backend && pytest

lint: ## Lint backend (ruff) and frontend (eslint)
	cd backend && ruff check app tests
	cd frontend && npm run lint

docker-build: ## Build all Docker images
	docker compose build

docker-up: ## Start the full stack with Docker
	docker compose up --build

docker-down: ## Stop the Docker stack
	docker compose down

clean: ## Remove caches and build artifacts
	rm -rf backend/.cache backend/.tmp backend/.pytest_cache
	rm -rf frontend/.next frontend/node_modules/.cache
