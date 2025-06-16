// src/LiveShaderEditor.jsx

import { useState, useMemo, useRef, useEffect } from 'react';
import { ShaderCanvas } from 'shader-canvas'; // The library you chose
import { buildShaderFromSnippets } from './shaderBuilder';

const initialShaderCode = `
// @uniforms
uniform float u_time;
uniform vec2 u_mouse;

// @transform
vec2 center = u_mouse;
float angle = u_time * -0.3;
mat2 rotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
st = (rotation * (st - center)) + center;

// @color
color.r += sin(u_time) * 0.5 + 0.5;
`.trim();

export function LiveShaderEditor() {
  const [shaderCode, setShaderCode] = useState(initialShaderCode);
  const canvasRef = useRef(null); // Ref to our <canvas> element
  const shaderInstanceRef = useRef(null); // Ref to the ShaderCanvas instance

  const fragmentShader = useMemo(() => {
    return buildShaderFromSnippets(shaderCode);
  }, [shaderCode]);

  // This effect runs ONCE to initialize the ShaderCanvas instance
  useEffect(() => {
    if (canvasRef.current) {
      const shader = new ShaderCanvas(canvasRef.current);
      shaderInstanceRef.current = shader;

      // Set the initial texture
      shader.setTexture('u_texture', './image/901464_400093426755894_1205176414_o.jpg', {
        // Optional: Add texture settings here
      });

      console.log("ShaderCanvas initialized.");
    }
  }, []); // Empty array means this runs only on mount

  // This effect runs whenever the GLSL code changes
  useEffect(() => {
    if (shaderInstanceRef.current) {
      shaderInstanceRef.current.setShader(fragmentShader);
    }
  }, [fragmentShader]);

  // This effect sets up the render loop
  useEffect(() => {
    const shader = shaderInstanceRef.current;
    if (!shader) return;

    let animationFrameId;

    const render = (time) => {
      shader.setUniforms({ u_time: time / 1000 });
      shader.render();
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    // Cleanup function to stop the loop when the component unmounts
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handleMouseMove = (event) => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / canvas.width;
      const y = 1.0 - (event.clientY - rect.top) / canvas.height;
      shaderInstanceRef.current?.setUniforms({ u_mouse: [x, y] });
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <textarea
        value={shaderCode}
        onChange={(e) => setShaderCode(e.target.value)}
        style={{
          position: 'absolute', zIndex: 10, width: '30%', height: '40%',
          top: '5%', right: '5%', fontFamily: 'monospace',
          backgroundColor: 'rgba(0,0,0,0.7)', color: '#00ff00', border: '1px solid #00ff00'
        }}
      />
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
