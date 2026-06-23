PYTHON ?= python3
PORT ?= 8765

.DEFAULT_GOAL := help

.PHONY: help build serve preview stop

help:
	@echo "POWDER Web commands:"
	@echo "  make preview          Build and serve at http://127.0.0.1:$(PORT)"
	@echo "  make serve            Serve the existing build"
	@echo "  make stop             Stop the managed preview server"
	@echo "  make build            Build the WebAssembly application"
	@echo "  make serve PORT=8766  Use a different preview port"

build:
	./scripts/build.sh

serve:
	$(PYTHON) scripts/serve.py $(PORT)

preview: build
	$(PYTHON) scripts/serve.py $(PORT)

stop:
	$(PYTHON) scripts/serve.py --stop $(PORT)
