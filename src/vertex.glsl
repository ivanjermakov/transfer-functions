attribute vec2 position;
varying vec2 uv;

void main() {
    gl_Position = vec4(position, 0.0, 1.0);
    uv = (position + 1.0) * 0.5;
}
