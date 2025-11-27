.PHONY: install test test-unit test-watch test-integration lint summary setup docker-up docker-down docker-init clean

setup: | .env docker-up docker-init install
	@echo "Setup complete. Run 'pnpm start:dev' to start the application."

.env:
	@test -f .env || cp .env.example .env

docker-up:
	@docker-compose up -d
	@sleep 5

docker-down:
	@docker-compose down

docker-init:
	@docker-compose exec -T event-store mongosh --eval \
		"rs.initiate({_id: 'vf-event-store-repl-set', members: [{_id: 0, host: 'localhost:27017'}]})" \
		2>/dev/null || true

clean:
	@docker-compose down -v
	@rm -rf node_modules
	@rm -f .env

install:
	pnpm install

test:
	pnpm test

test-unit:
	pnpm run test:unit

test-watch:
	pnpm run test:watch

test-integration:
	pnpm exec jest "src/alarms/integration/.*\\.spec\\.ts"

lint:
	pnpm run lint

summary:
	./scripts/test-summary.sh
