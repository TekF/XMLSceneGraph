precision mediump float;

vec2 iResolution = vec2(1500,500);

void main(void)
{
	gl_FragColour = vec4(gl_FragCoord.xy/iResolution,.5,1);
}
