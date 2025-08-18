import React, { useRef, useEffect } from 'react';
import p5 from 'p5';
import * as ms from '@magenta/image';

const MagentaSketch = () => {
  const sketchRef = useRef();

  useEffect(() => {
    const sketch = (p) => {
      let model;
      let modelState;
      const temperature = 0.45; // Controls the randomness
      let modelLoaded = false;
      let dx, dy;
      let x, y;
      let pen = [0, 0, 0];
      let previousPen = [1, 0, 0];
      const PEN = { DOWN: 0, UP: 1, END: 2 };

      p.setup = () => {
        const containerSize = sketchRef.current.getBoundingClientRect();
        p.createCanvas(containerSize.width, 400).parent(sketchRef.current); // Create canvas and attach it to the ref
        p.frameRate(60);

        // Load the model
        model = new ms.SketchRNN('https://storage.googleapis.com/quickdraw-models/sketchRNN/large_models/bird.gen.json');
        
        model.initialize().then(() => {
          model.setPixelFactor(3.0);
          modelLoaded = true;
          restart();
          console.log('SketchRNN model loaded.');
        }).catch((error) => {
            console.error('Failed to initialize SketchRNN model:', error);
        });
      };

      const restart = () => {
        p.background(255);
        x = p.width / 2.0;
        y = p.height / 3.0;
        const lineColor = p.color(p.random(64, 224), p.random(64, 224), p.random(64, 224));
        p.strokeWeight(3.0);
        p.stroke(lineColor);

        // Reset the model state
        [dx, dy, ...pen] = model.zeroInput();
        modelState = model.zeroState();
      };

      p.draw = () => {
        if (!modelLoaded) {
          return;
        }

        if (previousPen[PEN.END] === 1) {
          restart();
          return;
        }

        // Generate the next stroke
        modelState = model.update([dx, dy, ...pen], modelState);
        const pdf = model.getPDF(modelState, temperature);
        [dx, dy, ...pen] = model.sample(pdf);

        // Draw the stroke
        if (previousPen[PEN.DOWN] === 1) {
          p.line(x, y, x + dx, y + dy);
        }

        // Update the position
        x += dx;
        y += dy;
        previousPen = pen;
      };
    };

    // Create the p5 instance
    let p5Instance = new p5(sketch);

    // Cleanup function to remove the p5 instance when the component unmounts
    return () => {
      p5Instance.remove();
    };
  }, []); // The empty dependency array ensures this effect runs only once

  return <div ref={sketchRef} />;
};

export default MagentaSketch;
