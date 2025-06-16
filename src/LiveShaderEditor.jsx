// src/LiveShaderEditor.jsx

import { useState, useMemo, useRef, useEffect } from 'react';
import { ShaderCanvas } from 'shader-canvas';
import { buildShaderFromSnippets } from './shaderBuilder';
import { useTexture } from './useTexture'; // Import our new hook

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
  const canvasRef = useRef(null);
  const shaderInstanceRef = useRef(null);

  // --- NEW: Use our custom hook to load the texture ---
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
      shaderInstanceRef.current.setShader(fragmentShader);
    }
  }, [fragmentShader]);

  // Effect to run the render loop
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
    return () => cancelAnimationFrame(animationFrameId);
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
