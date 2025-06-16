// src/shaderBuilder.js

const FSHader_Template = `
precision highp float;
// shader-canvas provides v_texCoord, u_time, u_resolution
varying vec2 v_texCoord;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform sampler2D u_texture;

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

  const finalFShader = FSHader_Template
    .replace('// __UNIFORMS__', uniformSnippets)
    .replace('// __TRANSFORM__', transformSnippets)
    .replace('// __COLOR__', colorSnippets);

  return finalFShader;
}
