#version 300 es
precision highp float;

in vec2 uv;

uniform sampler2D tex;
uniform uint mode;
uniform float exposure;
uniform uint transferFn;
uniform float gamma;

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
		vec3( 0.59719, 0.07600, 0.02840 ),
		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
    );
    mat3 outputMatrix = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),
		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
    );
    vec3 va = inputMatrix * v;
    va = rttOdtFit(va);
    return outputMatrix * va;
}

vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}

vec3 tfAgx(vec3 color) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;
	const float AgxMaxEv = 4.026069;
    const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
        vec3( 1.6605, - 0.1246, - 0.0182 ),
        vec3( - 0.5876, 1.1329, - 0.1006 ),
        vec3( - 0.0728, - 0.0083, 1.1187 )
    );
    const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
        vec3( 0.6274, 0.0691, 0.0164 ),
        vec3( 0.3293, 0.9195, 0.0880 ),
        vec3( 0.0433, 0.0113, 0.8956 )
    );

	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;

	color = max( color, 1e-10 );
	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );

	return color;
}

vec3 gammaCorrection(vec3 v, float gamma) {
    return pow(v, vec3(1. / gamma));
}

void main() {
    vec3 inp;
    if (mode == 0u) {
        float hue = 1. - uv.y;
        vec3 color = hslToRgb(vec3(hue, 1., .5));
        float intensity = uv.x * 10.;
        inp = color * intensity;
    } else if (mode == 1u) {
        inp = vec3(uv.x);
    } else if (mode == 2u) {
        vec3 texel = texture(tex, uv).rgb;
        inp = texel;
    }
    inp *= exposure;

    vec3 outp;
    if (transferFn == 0u) {
        outp = tfRaw(inp);
    } else if (transferFn == 1u) {
        outp = tfReinhard(inp);
    } else if (transferFn == 2u) {
        outp = tfHableFilmic(inp);
    } else if (transferFn == 3u) {
        outp = tfAces(inp);
    } else if (transferFn == 4u) {
        outp = tfAgx(inp);
    }

    outp = gammaCorrection(outp, gamma);
    fragColor = vec4(outp, 1.);
}
