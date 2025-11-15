// public/openmpt-processor.js

// Import the Emscripten-built ES6 module
import libopenmpt from './libopenmpt.js';

/**
 * This class will be instantiated in the AudioWorkletGlobalScope.
 */
class OpenMPTProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.libopenmptModule = null;
    this.libopenmptPlayer = null;
    this.audioBufferL = null; // Pre-allocated buffer for left channel
    this.audioBufferR = null; // Pre-allocated buffer for right channel

    this.isPlaying = false;
    this.updateInterval = 128; // How often to send updates (in process calls)
    this.updateCounter = 0;

    // Initialize the module and set up message listener
    this.initModule();
  }

  async initModule() {
    // Wait for the Emscripten module (and WASM) to be ready
    this.libopenmptModule = await libopenmpt();

    // Create the player instance
    // We pass the module instance to the player as seen in your hook
    this.libopenmptPlayer = new this.libopenmptModule.libopenmpt.OKAY_Player(
      this.libopenmptModule,
    );

    // Set up the message handler to receive commands from the React hook
    this.port.onmessage = (event) => {
      const { type, data } = event.data;
      switch (type) {
        case 'load':
          this.loadModule(data);
          break;
        case 'play':
          this.play();
          break;
        case 'pause':
          this.pause();
          break;
        case 'stop':
          this.stop();
          break;
        case 'seek':
          this.seek(data);
          break;
      }
    };

    // Tell the main thread we are ready
    this.port.postMessage({ type: 'ready' });
  }

  loadModule(moduleData) {
    if (!this.libopenmptPlayer) return;

    // Your hook uses an ArrayBuffer
    const buffer = new Uint8Array(moduleData);
    try {
      this.libopenmptPlayer.load(buffer);
      this.isPlaying = false;

      // Send module metadata back to the main thread
      this.port.postMessage({
        type: 'metadata',
        data: {
          title: this.libopenmptPlayer.get_title(),
          artist: this.libopenmptPlayer.get_artist(),
          tracker: this.libopenmptPlayer.get_tracker(),
          info: this.libopenmptPlayer.get_info(),
          numChannels: this.libopenmptPlayer.get_num_channels(),
          numInstruments: this.libopenmptPlayer.get_num_instruments(),
          numPatterns: this.libopenmptPlayer.get_num_patterns(),
          numSamples: this.libopenmptPlayer.get_num_samples(),
          numOrders: this.libopenmptPlayer.get_num_orders(),
          duration: this.libopenmptPlayer.get_duration(),
        },
      });

      // Pre-allocate audio buffers based on the standard 128-frame block size
      this.audioBufferL = new Float32Array(128);
      this.audioBufferR = new Float32Array(128);

    } catch (e) {
      this.port.postMessage({ type: 'error', data: 'Failed to load module.' });
      console.error(e);
    }
  }

  play() {
    this.isPlaying = true;
  }

  pause() {
    this.isPlaying = false;
  }

  stop() {
    this.isPlaying = false;
    // Seek to beginning
    if (this.libopenmptPlayer) {
      this.libopenmptPlayer.seek(0);
    }
  }

  seek(position) {
    if (this.libopenmptPlayer) {
      this.libopenmptPlayer.seek(position);
    }
  }

  /**
   * This is the main audio processing loop.
   * It's called by the browser's audio engine every ~128 samples.
   */
  process(inputs, outputs, parameters) {
    // If the player isn't ready or isn't playing, do nothing.
    if (!this.libopenmptPlayer || !this.isPlaying) {
      return true; // Keep processor alive
    }

    const output = outputs[0];
    const channelLeft = output[0];
    const channelRight = output[1];

    // Use our pre-allocated buffers
    // This avoids allocating new arrays in the real-time audio loop
    this.audioBufferL.fill(0);
    this.audioBufferR.fill(0);

    // Call the libopenmpt C++ process function
    // It will fill our buffers with audio data
    this.libopenmptPlayer.process(this.audioBufferL, this.audioBufferR);

    // Copy the data from our buffers to the output buffers
    channelLeft.set(this.audioBufferL);
    channelRight.set(this.audioBufferR);

    // --- Send updates back to the main thread ---
    // We use a counter to avoid sending messages on every single audio block
    this.updateCounter++;
    if (this.updateCounter >= this.updateInterval) {
      this.updateCounter = 0;

      // Get data from the player
      const position = this.libopenmptPlayer.get_position_data();
      const pattern = this.libopenmptPlayer.get_pattern_data();

      // Send data back to the React hook
      this.port.postMessage({
        type: 'update',
        data: {
          position: {
            currentOrder: position.current_order,
            currentRow: position.current_row,
            currentPattern: position.current_pattern,
            position: position.position,
            speed: position.speed,
            tempo: position.tempo,
          },
          pattern: {
            // We need to clone the data to send it across the thread boundary
            // (Your original get_pattern_data() returns an object with typed arrays)
            left: [...pattern.left],
            right: [...pattern.right],
            center: [...pattern.center],
          },
        },
      });
    }

    return true; // Keep processor alive
  }
}

// Register the processor with the browser
registerProcessor('openmpt-processor', OpenMPTProcessor);
