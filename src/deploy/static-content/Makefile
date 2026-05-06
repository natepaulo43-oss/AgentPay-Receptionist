CONTENT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))../../../frontend

build-StaticContentDeployFunction:
	mkdir -p $(ARTIFACTS_DIR)/content-assets
	cp -r $(CONTENT_DIR)/* $(ARTIFACTS_DIR)/content-assets/
	cp $(dir $(abspath $(lastword $(MAKEFILE_LIST))))index.js $(ARTIFACTS_DIR)/index.js
