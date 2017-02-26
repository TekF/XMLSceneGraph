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
	
	var canvases = root.getElementsByTagName("canvas");
//	for ( canvas in canvases ) <- why doesn't this work? is it pointing to some kind of reference type?
	for( i = 0; i < canvases.length; i++ )
	{
		var canvas = canvases[i];
		console.log( "found canvas" );
		for(j = 0; j < canvas.childNodes.length; j++)
		{
			var child = canvas.childNodes[j];
			if ( child.nodeType == 3 ) continue; // ignore text nodes
			console.log( child.nodeName );
		}
	}
	
}


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