var Lab = (function(Validation, TinyTurtle, PNGBaker) {
  var DEFAULT_CANVAS_SIZE = 250;
  var TURTLE_WIDTH = 10;
  var TURTLE_HEIGHT = 10;
  var RENDER_DELAY_MS = 100;
  var WORKER_TIMEOUT_MS = 2000;
  var STRINGS = {
    WORKER_TIMEOUT_MSG: "Your code has taken too long to execute. " +
                        "Perhaps it contains an infinite loop?"
  };

  var baseURL = (function() {
    // http://stackoverflow.com/a/3326554/2422398
    var scripts = document.getElementsByTagName('script');
    var myURL = scripts[scripts.length - 1].src;
    return myURL.split('/').slice(0, -1).join('/') + '/';
  })();

  function activateLabs() {
    var labs = document.querySelectorAll('div[data-role="lab"]');
    for (var i = 0; i < labs.length; i++)
      Lab(labs[i]);
  }

  function Lab(parent) {
    if (!parent) parent = document.createElement('div');

    var $ = parent.querySelector.bind(parent);
    var turtle;
    var worker;
    var source;
    var renderDelayTimeout;
    var workerTimeout;
    var bakedImgURL;
    var workerURL = baseURL + 'worker.js';
    var code = $(".code");
    var canvasImg = $(".canvas");
    var canvas = document.createElement('canvas');
    var error = $(".error");
    var script = $("script");

    function queueRendering() {
      clearTimeout(renderDelayTimeout);
      renderDelayTimeout = setTimeout(render, RENDER_DELAY_MS);
    }

    function killWorker() {
      if (!worker) return;
      clearTimeout(workerTimeout);
      worker.terminate();
      worker = null;
    }

    function bakeCanvas() {
      var baker = new PNGBaker(canvas.toDataURL());
      var URL = window.URL || window.webkitURL;
      baker.textChunks['tiny-turtle-source'] = encodeURIComponent(source);
      if (bakedImgURL) URL.revokeObjectURL(bakedImgURL);
      canvasImg.blob = baker.toBlob();
      canvasImg.src = bakedImgURL = URL.createObjectURL(canvasImg.blob);
    }

    function drawCmds(cmds) {
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      cmds.forEach(function(cmd) {
        if (cmd.msg == 'turtle-propset')
          Validation.setProperty(turtle, cmd.property, cmd.value);
        else if (cmd.msg == 'turtle-methodcall')
          Validation.callMethod(turtle, cmd.method, cmd.args);
      });
    }

    function finishWorker(cmds, err) {
      killWorker();
      if (err) {
        error.classList.add("shown");
        error.textContent = (err.lineno ? "Line " + err.lineno + ": " : '') +
                            err.message;
        // If nothing was displayed, don't draw an empty canvas, b/c we don't
        // want to unnecessarily distract the user if they're in the middle
        // of typing.
        if (!cmds.length) return;
        // Otherwise, show what was drawn before the error as a debugging
        // aid.
      } else {
        // Note that we would just use classList.toggle() with !!err as
        // the second arg, but it appears to be broken in IE10.
        error.classList.remove("shown");
      }
      drawCmds(cmds);
      bakeCanvas();
    }

    function render() {
      var cmds = [];

      if (code.value == source) return;
      source = code.value;
      killWorker();
      turtle = new TinyTurtle(canvas);
      worker = new Worker(workerURL);
      worker.onmessage = function(e) {
        if (e.data.msg == 'done')
          finishWorker(cmds, null);
        else
          cmds.push(e.data);
      };
      worker.onerror = finishWorker.bind(null, cmds);
      worker.postMessage({
        source: code.value,
        height: canvas.height,
        width: canvas.width
      });
      workerTimeout = setTimeout(function() {
        finishWorker(cmds, new Error(STRINGS.WORKER_TIMEOUT_MSG));
      }, WORKER_TIMEOUT_MS);
    }

    function onDragEvent(e) {
      if (e.type == 'drop') {
        if (e.dataTransfer.files.length) {
          var file = e.dataTransfer.files[0];
          if (file.type == 'image/png') {
            var reader = new FileReader();
            reader.onloadend = function() {
              var baker = new PNGBaker(reader.result);
              var bakedSource = baker.textChunks['tiny-turtle-source'];
              if (bakedSource) {
                code.value = decodeURIComponent(bakedSource);
                render();
              }
            };
            reader.readAsArrayBuffer(file);
            e.stopPropagation();
            e.preventDefault();
          }
        }
        return;
      } else {
        e.stopPropagation();
        e.preventDefault();
      }
    }

    parent.setAttribute('data-role', 'lab');
    parent.classList.add('lab');
    if (!canvasImg) {
      canvasImg = document.createElement('img');
      canvasImg.classList.add('canvas');
      canvasImg.width = canvasImg.height = DEFAULT_CANVAS_SIZE;
      parent.appendChild(canvasImg);
    }
    if (!code) {
      code = document.createElement('textarea');
      code.classList.add('code');
      code.setAttribute('spellcheck', 'false');
      parent.appendChild(code);
    }
    if (script) code.value = script.textContent.trim();
    if (!error) {
      error = document.createElement('div');
      error.classList.add('error');
      parent.appendChild(error);
    }

    ['dragenter', 'dragleave', 'dragover', 'drop'].forEach(function(type) {
      parent.addEventListener(type, onDragEvent);
    });
    if (navigator.msSaveOrOpenBlob)
      // IE10's "Save Picture As..." strips out the tEXt chunks from our
      // PNG, so we'll override things to provide our own functionality.
      canvasImg.addEventListener('contextmenu', function(e) {
        if (!this.blob) return;
        navigator.msSaveOrOpenBlob(this.blob, 'canvas.png');
        e.preventDefault();
      });
    canvas.width = canvasImg.width; canvas.height = canvasImg.height;
    code.addEventListener('keyup', queueRendering, false);
    code.addEventListener('change', queueRendering, false);

    parent.render = render;
    parent.code = code;

    render();

    return parent;
  }

  document.addEventListener("DOMContentLoaded", activateLabs, false);

  return Lab;
})(Validation, TinyTurtle, PNGBaker);
