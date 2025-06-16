// src/LiveShaderEditor.jsx

import { useState, useMemo, useRef, useEffect } from 'react';
import { ShaderCanvas } from 'shader-canvas';
import { buildShaderFromSnippets } from './shaderBuilder';
import { useTexture } from './useTexture';
const vertexShader = `
  #version 300 es

  // `in` is the new keyword for attributes
  in vec2 a_position;

  // `out` is the new keyword for varyings
  out vec2 v_texCoord;

  void main() {
    gl_Position = vec4((a_position * 2.0 - 1.0) * vec2(1, -1), 0.0, 1.0);
    v_texCoord = a_position;
  }
`.trim();

const initialShaderCode = `
// @uniforms
uniform float u_strength;

// @transform
vec2 center = u_mouse;
float angle = u_time * 0.5;
mat2 rotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
vec2 centered_st = st - center;
centered_st = rotation * centered_st;
st = centered_st + center;
float dist = distance(st, center);
st.x += sin(dist * 20.0 + u_time * 2.0) * 0.02 * u_strength;

// @color
// The input 'color' variable is now named 'inColor'
inColor.rgb *= 1.2;
`.trim();


export function LiveShaderEditor() {
  const [shaderCode, setShaderCode] = useState(initialShaderCode);
  const [strength, setStrength] = useState(1.0);
  const canvasRef = useRef(null);
  const shaderInstanceRef = useRef(null);
  const texture = useTexture('./image/901464_400093426755894_1205176414_o.jpg');

  const fragmentShader = useMemo(() => {
    return buildShaderFromSnippets(shaderCode);
  }, [shaderCode]);

  useEffect(() => {
    if (canvasRef.current) {
      shaderInstanceRef.current = new ShaderCanvas(canvasRef.current);
    }
  }, []);

  useEffect(() => {
    const shader = shaderInstanceRef.current;
    if (shader && texture) {
      shader.setTexture('u_texture', texture);
    }
  }, [texture]);

  useEffect(() => {
    const shader = shaderInstanceRef.current;
    if (shader) {
      // This is the critical line to ensure both shaders are loaded
      shader.setShader(fragmentShader, vertexShader);
    }
  }, [fragmentShader]);

  useEffect(() => {
    const shader = shaderInstanceRef.current;
    if (!shader) return;
    let animationFrameId;
    const render = (time) => {
      shader.setUniforms({ u_time: time / 1000, u_strength: strength });
      shader.render();
      animationFrameId = requestAnimationFrame(render);
    };
    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [strength]);

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
      <div style={{ position: 'absolute', zIndex: 20, top: '5%', left: '5%', background: 'rgba(0,0,0,0.5)', padding: '10px', color: 'white' }}>
        <label>Strength: </label>
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
