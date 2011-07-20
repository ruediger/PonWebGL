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

  if(e.keyCode == KeyEvent.DOM_VK_UP) {
    bar1H += DH;
    if(bar1H > 3.6) bar1H = 3.6;
  }
  else if(e.keyCode == KeyEvent.DOM_VK_DOWN) {
    bar1H -= DH;
    if(bar1H < -3.6) bar1H = -3.6;
  }
  if(e.keyCode == KeyEvent.DOM_VK_W) { // up
    bar0H += DH;
    if(bar0H > 3.6) bar0H = 3.6;
  }
  else if(e.keyCode == KeyEvent.DOM_VK_S) { // down
    bar0H -= DH;
    if(bar0H < -3.6) bar0H = -3.6;
  }
  else if(e.keyCode == KeyEvent.DOM_VK_X) {
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
  if(typeof KeyEvent == "undefined") { // compatibility for broken browsers such as Chrome
    KeyEvent = {
      DOM_VK_CANCEL: 3,
      DOM_VK_HELP: 6,
      DOM_VK_BACK_SPACE: 8,
      DOM_VK_TAB: 9,
      DOM_VK_CLEAR: 12,
      DOM_VK_RETURN: 13,
      DOM_VK_ENTER: 14,
      DOM_VK_SHIFT: 16,
      DOM_VK_CONTROL: 17,
      DOM_VK_ALT: 18,
      DOM_VK_PAUSE: 19,
      DOM_VK_CAPS_LOCK: 20,
      DOM_VK_ESCAPE: 27,
      DOM_VK_SPACE: 32,
      DOM_VK_PAGE_UP: 33,
      DOM_VK_PAGE_DOWN: 34,
      DOM_VK_END: 35,
      DOM_VK_HOME: 36,
      DOM_VK_LEFT: 37,
      DOM_VK_UP: 38,
      DOM_VK_RIGHT: 39,
      DOM_VK_DOWN: 40,
      DOM_VK_PRINTSCREEN: 44,
      DOM_VK_INSERT: 45,
      DOM_VK_DELETE: 46,
      DOM_VK_0: 48,
      DOM_VK_1: 49,
      DOM_VK_2: 50,
      DOM_VK_3: 51,
      DOM_VK_4: 52,
      DOM_VK_5: 53,
      DOM_VK_6: 54,
      DOM_VK_7: 55,
      DOM_VK_8: 56,
      DOM_VK_9: 57,
      DOM_VK_SEMICOLON: 59,
      DOM_VK_EQUALS: 61,
      DOM_VK_A: 65,
      DOM_VK_B: 66,
      DOM_VK_C: 67,
      DOM_VK_D: 68,
      DOM_VK_E: 69,
      DOM_VK_F: 70,
      DOM_VK_G: 71,
      DOM_VK_H: 72,
      DOM_VK_I: 73,
      DOM_VK_J: 74,
      DOM_VK_K: 75,
      DOM_VK_L: 76,
      DOM_VK_M: 77,
      DOM_VK_N: 78,
      DOM_VK_O: 79,
      DOM_VK_P: 80,
      DOM_VK_Q: 81,
      DOM_VK_R: 82,
      DOM_VK_S: 83,
      DOM_VK_T: 84,
      DOM_VK_U: 85,
      DOM_VK_V: 86,
      DOM_VK_W: 87,
      DOM_VK_X: 88,
      DOM_VK_Y: 89,
      DOM_VK_Z: 90,
      DOM_VK_CONTEXT_MENU: 93,
      DOM_VK_NUMPAD0: 96,
      DOM_VK_NUMPAD1: 97,
      DOM_VK_NUMPAD2: 98,
      DOM_VK_NUMPAD3: 99,
      DOM_VK_NUMPAD4: 100,
      DOM_VK_NUMPAD5: 101,
      DOM_VK_NUMPAD6: 102,
      DOM_VK_NUMPAD7: 103,
      DOM_VK_NUMPAD8: 104,
      DOM_VK_NUMPAD9: 105,
      DOM_VK_MULTIPLY: 106,
      DOM_VK_ADD: 107,
      DOM_VK_SEPARATOR: 108,
      DOM_VK_SUBTRACT: 109,
      DOM_VK_DECIMAL: 110,
      DOM_VK_DIVIDE: 111,
      DOM_VK_F1: 112,
      DOM_VK_F2: 113,
      DOM_VK_F3: 114,
      DOM_VK_F4: 115,
      DOM_VK_F5: 116,
      DOM_VK_F6: 117,
      DOM_VK_F7: 118,
      DOM_VK_F8: 119,
      DOM_VK_F9: 120,
      DOM_VK_F10: 121,
      DOM_VK_F11: 122,
      DOM_VK_F12: 123,
      DOM_VK_F13: 124,
      DOM_VK_F14: 125,
      DOM_VK_F15: 126,
      DOM_VK_F16: 127,
      DOM_VK_F17: 128,
      DOM_VK_F18: 129,
      DOM_VK_F19: 130,
      DOM_VK_F20: 131,
      DOM_VK_F21: 132,
      DOM_VK_F22: 133,
      DOM_VK_F23: 134,
      DOM_VK_F24: 135,
      DOM_VK_NUM_LOCK: 144,
      DOM_VK_SCROLL_LOCK: 145,
      DOM_VK_COMMA: 188,
      DOM_VK_PERIOD: 190,
      DOM_VK_SLASH: 191,
      DOM_VK_BACK_QUOTE: 192,
      DOM_VK_OPEN_BRACKET: 219,
      DOM_VK_BACK_SLASH: 220,
      DOM_VK_CLOSE_BRACKET: 221,
      DOM_VK_QUOTE: 222,
      DOM_VK_META: 224
    };
  }

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

    document.addEventListener('keydown', keyevent, true);
    requestAnimFrame(draw);
  }
}
