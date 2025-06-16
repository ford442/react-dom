// src/shaderBuilder.js

// This "prelude" contains all the uniforms and varyings that shader-canvas provides automatically.
// We will always add this to the start of the user's shader.
const GLSL_PRELUDE = `
precision highp float;

// Varying from the vertex shader
varying vec2 v_texCoord;

// Uniforms automatically provided by shader-canvas
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;

// Our main texture uniform
uniform sampler2D u_texture;
`;

// The template is now much cleaner.
const FSHader_Template = `
// __UNIFORMS__

void main() {
  vec2 st = v_texCoord;

  // __TRANSFORM__

  vec4 color = texture2D(u_texture, st);

  // __COLOR__
  
  gl_FragColor = color;
}
`;

function extractSnippet(code, tag) {
  const regex = new RegExp(`// ${tag}[\\s\\S]*?(?=(// @|$))`, 'g');
  const match = code.match(regex);
  if (!match) return '';
  return match.map(m => m.replace(`// ${tag}`, '')).join('\n');
}

export function buildShaderFromSnippets(code) {
  const uniformSnippets = extractSnippet(code, '@uniforms');
  const transformSnippets = extractSnippet(code, '@transform');
  const colorSnippets = extractSnippet(code, '@color');

  // Build the shader by replacing the placeholders in the template
  const mainCode = FSHader_Template
    .replace('// __UNIFORMS__', uniformSnippets)
    .replace('// __TRANSFORM__', transformSnippets)
    .replace('// __COLOR__', colorSnippets);

  // Finally, combine the boilerplate prelude with the main code.
  // This guarantees the built-in uniforms are declared exactly once.
  const finalFShader = GLSL_PRELUDE + mainCode;

  return finalFShader;
}
