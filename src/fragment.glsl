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

vec3 tfReinhard(vec3 x) {
    return x / (1. + x);
}

vec3 tfHableFilmic_(vec3 x)
{
    float A = 0.15f;
    float B = 0.50f;
    float C = 0.10f;
    float D = 0.20f;
    float E = 0.02f;
    float F = 0.30f;
    return ((x*(A*x+C*B)+D*E)/(x*(A*x+B)+D*F))-E/F;
}

vec3 tfHableFilmic(vec3 v) {
    float exposure_bias = 2.0f;
    vec3 curr = tfHableFilmic_(v * exposure_bias);
    vec3 W = vec3(11.2f);
    vec3 white_scale = vec3(1.0f) / tfHableFilmic_(W);
    return curr * white_scale;
}

vec3 rttOdtFit(vec3 v) {
    vec3 a = v * (v + 0.0245786) - 0.000090537;
    vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
    return a / b;
}

vec3 tfAces(vec3 v) {
    mat3 inputMatrix = mat3(
        0.59719, 0.07600, 0.02840,
        0.35458, 0.90834, 0.13383,
        0.04823, 0.01566, 0.83777
    );
    mat3 outputMatrix = mat3(
        1.60475, -0.10208, -0.00327,
        -0.53108,  1.10813, -0.07276,
        -0.07367, -0.00605,  1.07602
    );
    vec3 va = inputMatrix * v;
    va = rttOdtFit(va);
    return outputMatrix * va;
}

void main() {
    vec3 inp;
    if (mode == 0u) {
        float hue = 1. - uv.y;
        vec3 color = hslToRgb(vec3(hue, 1., .5));
        float intensity = pow(uv.x * 4., 2.);
        inp = color * intensity * exposure;
    } else {
        vec3 texel = texture(tex, uv).rgb;
        inp = texel * exposure;
    }

    vec3 outp;
    if (transferFn == 0u) {
        outp = tfRaw(inp);
    } else if (transferFn == 1u) {
        outp = tfReinhard(inp);
    } else if (transferFn == 2u) {
        outp = tfHableFilmic(inp);
    } else if (transferFn == 3u) {
        outp = tfAces(inp);
    }

    fragColor = vec4(outp, 1.);
}
