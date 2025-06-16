// src/shaderBuilder.js

// UPDATED to GLSL 3.00 ES
const GLSL_PRELUDE = `
  #version 300 es
  precision highp float;
  in vec2 v_texCoord;

  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec2 u_mouse;

  uniform sampler2D u_texture;

  out vec4 outColor;
`;

// UPDATED to GLSL 3.00 ES
const FSHader_Template = `
// __UNIFORMS__

void main() {
  vec2 st = v_texCoord;

  // __TRANSFORM__

  vec4 inColor = texture(u_texture, st);

  // __COLOR__
  
  outColor = inColor;
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

  // The replacement logic remains the same
  const mainCode = FSHader_Template
    .replace('// __UNIFORMS__', uniformSnippets)
    .replace('// __TRANSFORM__', transformSnippets)
    .replace('// __COLOR__', colorSnippets);

  const finalFShader = GLSL_PRELUDE + mainCode;
  return finalFShader;
}
