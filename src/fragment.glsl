#version 300 es
precision highp float;

in vec2 uv;

uniform sampler2D tex;
uniform uint mode;
uniform float exposure;
uniform uint transferFn;

out vec4 fragColor;

float hueToRgb(float p, float q, float t) {
    if (t < 0.) t += 1.;
    if (t > 1.) t -= 1.;

    if (t < 1. /6.) return p + (q - p) * 6. * t;
    if (t < 1. /2.) return q;
    if (t < 2. /3.) return p + (q - p) * (2. / 3. - t) * 6.;

    return p;
}

vec3 hslToRgb(vec3 hsl) {
    float h = hsl.x;
    float s = hsl.y;
    float l = hsl.z;

    float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
    float p = 2.0 * l - q;

    return vec3(
        hueToRgb(p, q, h + 1.0/3.0),
        hueToRgb(p, q, h),
        hueToRgb(p, q, h - 1.0/3.0)
    );
}

vec3 tfRaw(vec3 x) {
    return x;
}

void main() {
    vec3 inp;
    if (mode == 0u) {
        float hue = 1. - uv.y;
        vec3 color = hslToRgb(vec3(hue, 1., .5));
        float intensity = uv.x * 2.;
        inp = color * intensity * exposure;
    } else {
        vec3 texel = texture(tex, uv).rgb;
        inp = texel * exposure;
    }

    vec3 outp;
    outp = tfRaw(inp);

    fragColor = vec4(outp, 1.);
}
