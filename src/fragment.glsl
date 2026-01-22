precision highp float;

varying vec2 v_uv;

uniform sampler2D u_texture;

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
    float exposure = 1.;
    // float hue = 1. - v_uv.y;
    // vec3 color = hslToRgb(vec3(hue, 1., .5));
    // float intensity = v_uv.x * 2.;
    // vec3 light = color * intensity;
    // vec3 mapped = tfRaw(light);
    // gl_FragColor = vec4(mapped, 1.);

    vec2 uv = vec2(v_uv.x, v_uv.y);
    vec3 texel = texture2D(u_texture, uv).rgb;
    vec3 light = texel * exposure;
    vec3 mapped = tfRaw(light);
    gl_FragColor = vec4(mapped, 1.);
}
