// src/LiveShaderEditor.jsx

import { useState, useMemo, useRef, useEffect } from 'react';
import { ShaderCanvas } from 'shader-canvas';
import { buildShaderFromSnippets } from './shaderBuilder';
import { useTexture } from './useTexture';

// The initial code is now cleaner.
// We only declare uniforms that are NOT built-in.
const initialShaderCode = `
// @uniforms
uniform float u_strength; // Our custom uniform

// @transform
// Create a swirling effect based on time and mouse position
vec2 center = u_mouse;
float angle = u_time * 0.5;
mat2 rotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
vec2 centered_st = st - center;
centered_st = rotation * centered_st;
st = centered_st + center;

// Add a ripple effect using our custom uniform
float dist = distance(st, center);
st.x += sin(dist * 20.0 + u_time * 2.0) * 0.02 * u_strength;

// @color
// Make the color brighter
color.rgb *= 1.2;
`.trim();

export function LiveShaderEditor() {
  // The rest of the component code remains exactly the same...
  const [shaderCode, setShaderCode] = useState(initialShaderCode);
  const [strength, setStrength] = useState(1.0); // State for our custom uniform
  const canvasRef = useRef(null);
  const shaderInstanceRef = useRef(null);
  const texture = useTexture('./image/901464_400093426755894_1205176414_o.jpg');

  const fragmentShader = useMemo(() => {
    return buildShaderFromSnippets(shaderCode);
  }, [shaderCode]);

  // Effect to initialize the ShaderCanvas instance (runs once)
  useEffect(() => {
    if (canvasRef.current) {
      shaderInstanceRef.current = new ShaderCanvas(canvasRef.current);
      console.log("ShaderCanvas initialized.");
    }
  }, []);

  // --- NEW: This effect waits for the texture to be loaded ---
  useEffect(() => {
    const shader = shaderInstanceRef.current;
    // Only set the texture if both the shader instance and the texture exist
    if (shader && texture) {
      shader.setTexture('u_texture', texture);
      console.log("Texture set successfully.");
    }
  }, [texture]); // This effect depends on the loaded texture

  // Effect to update the shader when the code changes
  useEffect(() => {
    if (shaderInstanceRef.current) {
      shaderInstanceRef.current.setShader(fragmentShader, vertexShader);
    }
  }, [fragmentShader]);

  // The render loop now also sets our custom uniform
  useEffect(() => {
    const shader = shaderInstanceRef.current;
    if (!shader) return;
    let animationFrameId;
    const render = (time) => {
      // Set built-in and custom uniforms
      shader.setUniforms({
        u_time: time / 1000,
        u_strength: strength
      });
      shader.render();
      animationFrameId = requestAnimationFrame(render);
    };
    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [strength]); // Re-start loop if strength changes



  const handleMouseMove = (event) => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / canvas.width;
      const y = 1.0 - (event.clientY - rect.top) / canvas.height;
      shaderInstanceRef.current?.setUniforms({ u_mouse: [x, y] });
    }
  };
  // Example of how you might add a slider for your custom uniform
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <div style={{ position: 'absolute', zIndex: 20, top: '5%', left: '5%', background: 'rgba(0,0,0,0.5)', padding: '10px', color: 'white' }}>
        <label>Strength</label>
        <input
          type="range"
          min="0.0"
          max="5.0"
          step="0.1"
          value={strength}
          onChange={(e) => setStrength(parseFloat(e.target.value))}
        />
      </div>
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
