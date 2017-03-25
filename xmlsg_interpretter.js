var gl;
var canvas;
var effect = []; // array of linked shader programs

var paused = false;

// globals

var fullscreenVA;

var posCopyVS;
var posCopyVSSource =
	`#version 300 es
	precision highp float;
	precision highp int;
	
	// INPUTS
	in vec4 position;
	/*can prefix these with layout(location = <n>) to share vertex formats across shaders that read non-consecutive attributes*/
	
	// OUTPUTS
	// gl_Position - not counted as an output
	
	void main()
	{
		gl_Position = position;
	}
	`;

var debugPS;
var debugPSSource =
	`#version 300 es
	precision highp float;
	precision highp int;
	
	out vec4 colour;
	
	void main()
	{
		colour = vec4(1.,.5,.0,1.);
	}
	`;

var egPS;
var egPSSource =
	`#version 300 es
	precision highp float;
	precision highp int;
	
	out vec4 colour;
	
	void main()
	{
		vec2 iResolution = vec2(1500,500);
		
		vec3 ray;
		ray.xy = (gl_FragCoord.xy-iResolution.xy*.5)/iResolution.y;

		vec3 pos = vec3(-2,1,-4);
		vec3 target = vec3(0,0,0);
		ray.z = 1.;

		vec3 forward = normalize(target-pos);
		vec3 right = normalize(cross(vec3(0,1,0),forward));
		vec3 up = cross(forward,right);
		ray = ray.x*right + ray.y*up + ray.z*forward;
		
		ray = normalize(ray);
		
		vec3 col = vec3(0);
		
		float t = 1e38;
		float tPlus = .0;
		
		vec3 c = vec3(0,0,0);
		float r = 1.;
		float loc = dot(ray,c-pos);
		float tSphere = loc*loc-dot(c-pos,c-pos)+r*r;
		if ( tSphere > .0 )
		{
			tSphere = loc - sqrt(tSphere);
			if ( tSphere < t )
			{
				t = tSphere;
				
				// reflection!
				vec3 pos = pos+ray*t;
				vec3 normal = normalize(pos-c);
				ray = reflect(ray,normal);
				tPlus = t;
				t = 1e38;
			}
		}
		
		float tPlane = (-1.-pos.y)/ray.y;
		if ( tPlane > .0 && tPlane < t )
		{
			t = tPlane;
			vec3 p = pos+ray*t;
			p = fract(p/2.)-.5;
			col = mix( vec3(0), vec3(1), step(.0,p.x*p.z) );
		}
		
		t += tPlus;
		col = mix( vec3(1), col, exp2(-vec3(.2,.4,1)*min(t,20./max(.01,ray.y))/50.) ); // can't remember maths for ground fog
		
		colour = vec4(pow(col,vec3(1./2.2)),1.);
	}
	`;

	
function Capture( canvasId )
{
/// AAARGH THIS IS THE WRONG POINT IN THE FRAME SO IT'S BLANK! - can set preserveDrawingBuffer  true, or do this right after rendering
	console.log("capturing...");
	var canv = document.getElementById(canvasId);
	if ( !canv ) alert("no canvas?!");
	var img = document.createElement("img");
	img.src = canv.toDataURL("image/png");
	document.body.appendChild(img);
//	document.write('<img src="'+img+'"/>');
}
		
		
function LoadSceneGraph( filename )
{
	console.log("begun!");
	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function()
		{
			console.log("called back...");
			if ( this.readyState == 4 && this.status == 200 )
			{
				ParseSceneGraph(this.responseXML.documentElement);
			}
		};
	xhttp.open("GET", filename, true);
	xhttp.send();
}

function ParseSceneGraph( root )
{
	console.log("Parsing...");
	
	// everything is surrounded by "\n" text nodes
	
	let canvases = root.getElementsByTagName("canvas");
//	for ( canvas in canvases ) <- why doesn't this work? is it pointing to some kind of reference type?
	for( i = 0; i < canvases.length; i++ ) // doesn't really support multiple canvases (yet)
	{
		console.log( "found canvas" );
		/*var canvas = canvases[i];
		for(j = 0; j < canvas.childNodes.length; j++)
		{
			var child = canvas.childNodes[j];
			if ( child.nodeType == 3 ) continue; // ignore text nodes
			console.log( child.nodeName );
		}*/
		
		canvas = document.createElement("canvas");
		canvas.id = i;
		canvas.width = canvases[i].getAttribute("width") || "640px";
		canvas.height = canvases[i].getAttribute("height") || "360px";
		document.body.appendChild(canvas);
		
		let button = document.createElement("button");
		button.onclick = function(){Capture(0/*i*/);}; //ffs how do I make it evaluate i now?!
		button.appendChild( document.createTextNode( "capture" ) );
		document.body.appendChild(button);
//		document.write("<button onclick='Capture("+i+")'>capture</button>");
	}

	// INITIALISE GLOBAL THINGS
	
	// init webgl
	gl = canvas.getContext("webgl2", {preserveDrawingBuffer: true});
	if ( !gl ) alert("WebGL 2 won't initialise");
	
	// full screen blit
//dammit, I don't like all this create,bind,setvalues,unbind crap!
	let vertexPosBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vertexPosBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1.,-1.,0.,1., -1.,3.,0.,1., 3.,-1.,0.,1.]), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	fullscreenVA = gl.createVertexArray();
	gl.bindVertexArray(fullscreenVA);
    gl.enableVertexAttribArray(0);
    gl.bindBuffer( gl.ARRAY_BUFFER, vertexPosBuffer ); // a triangle which will cover the whole screen in 1 pass, hopefully
    gl.vertexAttribPointer(0,4,gl.FLOAT,0,0,0);
	gl.bindVertexArray(null);
	
	// standard shaders
	posCopyVS = gl.createShader( gl.VERTEX_SHADER );
	gl.shaderSource( posCopyVS, posCopyVSSource );
	gl.compileShader( posCopyVS );
//	if ( !gl.getShaderParameter(posCopyVS, gl.COMPILE_STATUS) ) { alert( "could not compile shader:" + gl.getShaderInfoLog(posCopyVS) ); }
	
	debugPS = gl.createShader( gl.FRAGMENT_SHADER );
	gl.shaderSource( debugPS, debugPSSource );
	gl.compileShader( debugPS );
	
	egPS = gl.createShader( gl.FRAGMENT_SHADER );
	gl.shaderSource( egPS, egPSSource );
	gl.compileShader( egPS );
	if ( !gl.getShaderParameter(egPS, gl.COMPILE_STATUS) ) { alert( gl.getShaderInfoLog(egPS) ); return; }

	
	// INITIALISE SPECIFIC THINGS
	// e.g. create a vertex buffer per mesh, load textures
	// should this all go in globals? - ideally I'd like to have a global scene graph structure that I can parse quickly, which contains all the data.
	// xml dom is unsuited to that (lots of shenanigans) => should parse xml to actual JS structure
	// => should maybe do that first, so I can more easily "find all x under this"
// 1/ how do I "pushback" in a JS object?
// 2/ how do I pushback something with a name and attributes, to which I can later pushback children? => attr's are children (same as xml, but more native)

/*
	for ( pixelshader tags )
	{
		shaderPool.pushback = gl.creatshader( gl.PIXEL_SHADER );
		var xhttp = new XMLHttpRequest();
		xhttp.onreadystatechange = function()
			{
				if ( this.readyState == 4 && this.status == 200 )
				{
does it evaluate n here? confusing...
					gl.shaderSource( shaderPool[n], this.responseTex );
					gl.compileShader( shaderPool[n] );
				}
			};
		xhttp.open("GET", filename, true);
		xhttp.send();
	}
*/


	// link shader combinations used in scene
effect[0] = gl.createProgram();
gl.attachShader( effect[0], posCopyVS );
gl.attachShader( effect[0], egPS );
gl.linkProgram( effect[0] );
	
	if (gl) Draw();
}

var frame=0;

function Draw()
{
gl.useProgram(effect[0]);
gl.bindVertexArray(fullscreenVA);
gl.drawArrays(gl.TRIANGLE_STRIP, 0, 3);
gl.bindVertexArray(null);

frame++;
if ( frame > 100 ) paused = true;
	
	if ( paused )
	{
		console.log( "paused" );
	}
	else
	{
		window.requestAnimationFrame(Draw);
	}
}


/*

WEBGL2!!!
Simpler to set up - don't need extensions for (any of?) the things I used before!
NPOT - non-power of 2 textures! => render targets just match canvas!

Consider switching to:
Sampler objects - https://developer.mozilla.org/en-US/docs/Web/API/WebGLSampler
Uniform blocks - e.g. could have a block for MIDIMIX and params for iResolution etc
shader inputs & outputs specified inside shaders (will help me mix & match pixel & vert shaders) - can't find info on this, might not be webgl2 specific

*/



/*this works, but the fact that it's xml.childNodes[canvas].childNodes[fullscreen].childNodes[pixelShader]
rather than scenegraph.canvas0.fullscreen.pixelShader - which I could do in static JS - is kind of annoying...*/
//^ still, creation is easy, and MOST usage will be "find a pixel shader in this node" type things => fine.



/* SHADER LOADING from file
XMLHttpRequest() has .responseText - which won't be interpretted at all! => perfect! */



/*


ParseSceneGraph()
{
	for all PS nodes
		compile [if unique]
		replace with a reference to compiled shader (e.g. index into a list of shaders, if I can't do pointer)
	
	for all draw calls (fullscreen / mesh)
		link PS and VS (if fullscreen, have a single shared VS)
		store reference to linked effect
	
	for all canvas nodes
		if not hidden - add canvas element to scene
		[if referenced by any textures]
			create render target
			create texture
		^ => maybe have final target as a different thing, with no RT no texture - would make code & interface simpler
		- does webgl even support multiple canvases, or is it one per webgl instance?
	
	for all texture nodes
		if ( file )
			load file
			replace with reference to texture (in global texture list)
		else
			reference to buffer (in global texture list)
}


DrawFullscreen(node)
{
	glBindEffectBlah( gEffects[ getchild( "effect" ).index ] );
	
	for ( texture nodes )
	{
		glBindTextureBlah( textureNode.channel, gTextures[textureNode.index] );
	}
}

Render()
{
	for ( children of scenegraph in order )
	{
		switch ( type )
		{
//			case offscreentarget:
//			{
//				TODO;
//				break;
//			}
			case canvas:
			{
				bind final
				break;
			}
			default:
			{
				error;
			}
		}
		
		for ( children of render target )
		{
			switch( node.type )
			{
				case fullscreen:
				{
					DrawFullscreen(node);
					break;
				}
//				case mesh:
//				{
//					DrawMesh(node); todo;
//					break;
//				}
			}
		}
	}
}



*/