EMCC = emcc
CFLAGS = -O3

all: bridgit_bot.js

beam: bridgit_bot_beam.js

bridgit_bot_beam.js: bridgit_bot_beam.c
	$(EMCC) $(CFLAGS) bridgit_bot_beam.c \
		-s WASM=1 \
		-s 'EXPORTED_FUNCTIONS=["_wasm_computer_move","_wasm_computer_move_red","_wasm_set_depth","_wasm_set_base_widths","_wasm_set_widths","_wasm_set_extra2_widths","_wasm_set_red_variant","_wasm_load_nn_weights","_wasm_set_nn_eval","_wasm_set_resistance","_wasm_set_resistance_weights","_wasm_set_eval_noise","_wasm_get_last_score","_wasm_blue_distance","_wasm_red_dist_info","_malloc","_free"]' \
		-s 'EXPORTED_RUNTIME_METHODS=["ccall","cwrap","HEAPU8","HEAPF32","HEAP32","getValue"]' \
		-s MODULARIZE=1 \
		-s EXPORT_NAME='BridgitBot' \
		-s INITIAL_MEMORY=1048576 \
		-s ALLOW_MEMORY_GROWTH=0 \
		--no-entry \
		-o bridgit_bot_beam.js

bridgit_bot.js: bridgit_bot_beam.c
	$(EMCC) $(CFLAGS) bridgit_bot_beam.c \
		-s WASM=1 \
		-s 'EXPORTED_FUNCTIONS=["_wasm_computer_move","_wasm_set_depth","_wasm_set_base_widths","_wasm_set_widths","_wasm_set_extra2_widths","_wasm_set_resistance","_wasm_set_resistance_weights","_wasm_get_last_score","_wasm_blue_distance","_wasm_red_dist_info","_malloc","_free"]' \
		-s 'EXPORTED_RUNTIME_METHODS=["ccall","cwrap","HEAPU8","HEAPF32","HEAP32","getValue"]' \
		-s MODULARIZE=1 \
		-s EXPORT_NAME='BridgitBot' \
		-s INITIAL_MEMORY=1048576 \
		-s ALLOW_MEMORY_GROWTH=0 \
		--no-entry \
		-o bridgit_bot.js

clean:
	rm -f bridgit_bot.js bridgit_bot.wasm bridgit_bot_beam.js bridgit_bot_beam.wasm
