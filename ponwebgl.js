const xhtmluri = "http://www.w3.org/1999/xhtml";

var bar0VerticesBuffer, bar1VerticesBuffer, ballVerticesBuffer;
var bar0VerticesColorBuffer, bar1VerticesColorBuffer, ballVerticesColorBuffer;
var bar0H = 0.0, bar1H = 0.0, ballX = 0.0, ballY = 0.0, ballDX = 0.1, ballDY = 0.1;
var vertexPositionAttribute;
var vertexColorAttribute;
var perspectiveMatrix;
var shaderProgram;
var width;
var height;
var points0 = 0, points1 = 0;
var gl = null;

// copied from http://paulirish.com/2011/requestanimationframe-for-smart-animating/
window.requestAnimFrame = (function(){
  return  window.requestAnimationFrame       || 
          window.mozRequestAnimationFrame    || 
          window.webkitRequestAnimationFrame || 
          window.oRequestAnimationFrame      || 
          window.msRequestAnimationFrame     || 
          function(/* function */ callback, /* DOMElement */ element){
            window.setTimeout(callback, 1000 / 60);
          };
  })();
// end

// copied from MDC
var mvMatrix;

function loadIdentity() {
  mvMatrix = Matrix.I(4);
}

function multMatrix(m) {
  mvMatrix = mvMatrix.x(m);
}

function mvTranslate(v) {
  multMatrix(Matrix.Translation($V([v[0], v[1], v[2]])).ensure4x4());
}

function setMatrixUniforms() {
  var pUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
  gl.uniformMatrix4fv(pUniform, false, new Float32Array(perspectiveMatrix.flatten()));

  var mvUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
  gl.uniformMatrix4fv(mvUniform, false, new Float32Array(mvMatrix.flatten()));
}

var mvMatrixStack = [];

function mvPushMatrix(m) {
  if (m) {
    mvMatrixStack.push(m.dup());
    mvMatrix = m.dup();
  } else {
    mvMatrixStack.push(mvMatrix.dup());
  }
}

function mvPopMatrix() {
  if (!mvMatrixStack.length) {
    throw("Can't pop from an empty matrix stack.");
  }
  
  mvMatrix = mvMatrixStack.pop();
  return mvMatrix;
}

function mvRotate(angle, v) {
  var inRadians = angle * Math.PI / 180.0;
  
  var m = Matrix.Rotation(inRadians, $V([v[0], v[1], v[2]])).ensure4x4();
  multMatrix(m);
}

function getShader(gl, id) {
  var shaderScript = document.getElementById(id);
  
  // Didn't find an element with the specified ID; abort.
  
  if (!shaderScript) {
    return null;
  }
  
  // Walk through the source element's children, building the
  // shader source string.
  
  var theSource = "";
  var currentChild = shaderScript.firstChild;
  
  while(currentChild) {
    if (currentChild.nodeType == 3) {
      theSource += currentChild.textContent;
    }
    
    currentChild = currentChild.nextSibling;
  }
  
  // Now figure out what type of shader script we have,
  // based on its MIME type.
  
  var shader;
  
  if (shaderScript.type == "x-shader/x-fragment") {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (shaderScript.type == "x-shader/x-vertex") {
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
    return null;  // Unknown shader type
  }
  
  // Send the source to the shader object
  
  gl.shaderSource(shader, theSource);
  
  // Compile the shader program
  
  gl.compileShader(shader);
  
  // See if it compiled successfully
  
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert("An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader));
    return null;
  }
  
  return shader;
}
// end

function updateScore() {
  var scorebox = document.getElementById("scorebox");
  if(!scorebox) {
    return; // error
  }
  while(scorebox.childNodes.length >= 1) {
    scorebox.removeChild(scorebox.firstChild);
  }
  var txt = document.createElementNS(xhtmluri, "p");
  txt.appendChild(document.createTextNode(points0 + " : " + points1));
  scorebox.appendChild(txt);
}

function clearMsgbox() {
  var msgbox = document.getElementById("msgbox");
  if(!msgbox) {
    return null; // error
  }
  while(msgbox.childNodes.length >= 1) {
    msgbox.removeChild(msgbox.firstChild);
  }
  return msgbox;
}

function reportwin(player, goals) {
  var msgbox = clearMsgbox();
  if(!msgbox) {
    return; // error
  }
  msgbox.setAttribute("style", "border:1px solid black; color:red; font-size:150%; position:absolute; top:100px; left:100px; width:300px;");
  var txt = document.createElementNS(xhtmluri, "p");
  txt.appendChild(document.createTextNode("Player " + player + " scored a Goal!"));
  msgbox.appendChild(txt);

  updateScore();
}

var lastUpdate = 0; // TODO use window.mozAnimationStartTime
var lastgoal = 0;
function draw() {
  var time = (new Date()).getTime();
  if(lastUpdate) {
    var delta = time - lastUpdate;
    const dpmsec = 1/100.0;
    ballX += dpmsec * delta * ballDX;
    ballY += dpmsec * delta * ballDY;
    if(time - lastgoal > 1000) {
      clearMsgbox();
    }
    if(ballX > 5.5) { // goal for bar0
      ++points0;
      ballX = 0.0;
      ballY = 0.0;
      ballDX = 0.2;
      ballDY = 0.0;
      reportwin("1", points0);
      lastgoal = time;
    }
    else if(ballX < -5.5) { // goal for bar1
      ++points1;
      ballX = 0.0;
      ballY = 0.0;
      ballDX = -0.2;
      ballDY = 0.0;
      reportwin("2", points1);
      lastgoal = time;
    }
    const epsilon = 0.0001;
    if(ballY > 4.1) {
      ballY -= ballDY;
      ballDY = -ballDY;
      if(Math.abs(ballDX) < epsilon) ballDX = 0.1;
    }
    else if(ballY < -4.1) {
      ballY -= ballDY;
      ballDY = -ballDY;
      if(Math.abs(ballDX) < epsilon) ballDX = -0.1;
    }

    // collision
    if(3.8 <= ballX && ballX <= 4.2 && bar1H + 0.7 >= ballY && ballY >= bar1H - 0.7) {
      ballDX = -ballDX; // TODO check where the collision happens!
      if(Math.abs(ballDY) < epsilon)
        ballDY = 0.1;
    }
    else if(-4.2 <= ballX && ballX <= -3.8 && bar0H + 0.7 >= ballY && ballY >= bar0H - 0.7) {
      ballDX = -ballDX;
      if(Math.abs(ballDY) < epsilon)
        ballDY = -0.1;
    }
  }

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  perspectiveMatrix = makePerspective(45, width/height, 0.1, 100.0);
  loadIdentity();
  mvTranslate([-0.0, 0.0, -10.0]);

  mvPushMatrix();
  mvTranslate([-4.0, bar0H, 0.0]);
  gl.bindBuffer(gl.ARRAY_BUFFER, bar0VerticesBuffer);
  gl.vertexAttribPointer(vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, bar0VerticesColorBuffer);
  gl.vertexAttribPointer(vertexColorAttribute, 4, gl.FLOAT, false, 0, 0);
  setMatrixUniforms();
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  mvPopMatrix();

  mvPushMatrix();
  mvTranslate([+4.0, bar1H, 0.0]);
  gl.bindBuffer(gl.ARRAY_BUFFER, bar1VerticesBuffer);
  gl.vertexAttribPointer(vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, bar1VerticesColorBuffer);
  gl.vertexAttribPointer(vertexColorAttribute, 4, gl.FLOAT, false, 0, 0);
  setMatrixUniforms();
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  mvPopMatrix();

  mvPushMatrix();
  mvTranslate([ballX, ballY, 0.0]);
  gl.bindBuffer(gl.ARRAY_BUFFER, ballVerticesBuffer);
  gl.vertexAttribPointer(vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, ballVerticesColorBuffer);
  gl.vertexAttribPointer(vertexColorAttribute, 4, gl.FLOAT, false, 0, 0);
  setMatrixUniforms();
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 15);
  mvPopMatrix();

  lastUpdate = time;
  requestAnimFrame(draw);
}

function keyevent(e) {
  const DH = 0.2;

  if(e.keyCode == e.DOM_VK_UP) {
    bar1H += DH;
    if(bar1H > 3.6) bar1H = 3.6;
  }
  else if(e.keyCode == e.DOM_VK_DOWN) {
    bar1H -= DH;
    if(bar1H < -3.6) bar1H = -3.6;
  }
  if(e.keyCode == e.DOM_VK_W) { // up
    bar0H += DH;
    if(bar0H > 3.6) bar0H = 3.6;
  }
  else if(e.keyCode == e.DOM_VK_S) { // down
    bar0H -= DH;
    if(bar0H < -3.6) bar0H = -3.6;
  }
  else if(e.keyCode == e.DOM_VK_X) {
    alert("(" + ballX + "," + ballY + ") " + (bar1H + 0.7) + " " + (bar1H - 0.7));
  }
}

function createCircle(radius, numberOfSegments) {
  const radPerSeg = 2.0*Math.PI/numberOfSegments;

  var vertices = [];
  var rad = 0;
  var count = 0;
  while(rad <= 2.0*Math.PI) {
    var x = radius * Math.cos(rad);
    var y = radius * Math.sin(rad);
    vertices = vertices.concat([x, y, 0.0]);
    rad += radPerSeg;
    ++count;
    if(count >= 2) {
      vertices = vertices.concat([0.0, 0.0, 0.0]);
      count = 0;
    }
  }
  var x = radius * Math.cos(rad);
  var y = radius * Math.sin(rad);
  vertices = vertices.concat([x, y, 0.0]);
  return vertices;
}

function start() {
  var canvas = document.getElementById("glcanvas");
  
  width = parseInt(canvas.attributes["width"].value);
  height = parseInt(canvas.attributes["height"].value);

  updateScore(); // set score to 0:0

  try {
    gl = canvas.getContext("experimental-webgl");
  }
  catch(e) {
  }
  
  if (!gl) {
    alert("Unable to initialize WebGL. Your browser may not support it.");
  }
  else {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);                      // Set clear color to black, fully opaque
    gl.clearDepth(1.0);                                     // Clear everything
    gl.enable(gl.DEPTH_TEST);                               // Enable depth testing
    gl.depthFunc(gl.LEQUAL);                                // Near things obscure far things
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);      // Clear the color as well as the depth buffer.

    // load shaders
    var fragmentShader = getShader(gl, "shader-fs");
    var vertexShader = getShader(gl, "shader-vs");
    
    // Create the shader program
    
    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    
    // If creating the shader program failed, alert
    
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      alert("Unable to initialize the shader program.");
    }
    
    gl.useProgram(shaderProgram);
    
    vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(vertexPositionAttribute);

    vertexColorAttribute = gl.getAttribLocation(shaderProgram, "aVertexColor");
    gl.enableVertexAttribArray(vertexColorAttribute);

    // load graphics
    const barVertices = [
      0.2,  0.7, 0.0,
     -0.2,  0.7, 0.0,
      0.2, -0.7, 0.0,
     -0.2, -0.7, 0.0
    ];

    bar0VerticesBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bar0VerticesBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(barVertices), gl.STATIC_DRAW);

    bar1VerticesBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bar1VerticesBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(barVertices), gl.STATIC_DRAW);

    const red = [
      1.0,  0.0,  0.0,  1.0,
      1.0,  0.0,  0.0,  1.0,
      1.0,  0.0,  0.0,  1.0,
      1.0,  0.0,  0.0,  1.0
    ];
  
    bar0VerticesColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bar0VerticesColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(red), gl.STATIC_DRAW);

    const green = [
      0.0,  1.0,  0.0,  1.0,
      0.0,  1.0,  0.0,  1.0,
      0.0,  1.0,  0.0,  1.0,
      0.0,  1.0,  0.0,  1.0
    ];

    bar1VerticesColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bar1VerticesColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(green), gl.STATIC_DRAW);

    const segs = 12;
    const ballVertices = createCircle(0.1, segs);
/*    [
      0.1,  0.1, 0.0,
     -0.1,  0.1, 0.0,
      0.1, -0.1, 0.0,
     -0.1, -0.1, 0.0
    ];*/

    ballVerticesBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ballVerticesBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ballVertices), gl.STATIC_DRAW);

    var blue = [];
    for(var i = 0; i < segs*4/3; ++i) {
      blue = blue.concat([0.0, 0.0, 1.0, 1.0]);
    }

    ballVerticesColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ballVerticesColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(blue), gl.STATIC_DRAW);

    window.onkeydown = keyevent;
    requestAnimFrame(draw);
  }
}
