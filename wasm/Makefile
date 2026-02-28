EMCC = emcc
CFLAGS = -O3

all: bridgit_bot.js

bridgit_bot.js: bridgit_bot.c
	$(EMCC) $(CFLAGS) bridgit_bot.c \
		-s WASM=1 \
		-s 'EXPORTED_FUNCTIONS=["_wasm_computer_move","_wasm_init","_wasm_set_time_limit","_wasm_get_last_depth","_wasm_get_last_nodes","_wasm_blue_distance","_wasm_red_dist_info","_malloc","_free"]' \
		-s 'EXPORTED_RUNTIME_METHODS=["ccall","cwrap","HEAPU8","HEAP32","getValue"]' \
		-s MODULARIZE=1 \
		-s EXPORT_NAME='BridgitBot' \
		-s INITIAL_MEMORY=1048576 \
		-s ALLOW_MEMORY_GROWTH=0 \
		--no-entry \
		-o bridgit_bot.js

clean:
	rm -f bridgit_bot.js bridgit_bot.wasm
