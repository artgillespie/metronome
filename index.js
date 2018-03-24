function elid(id) {
  return document.getElementById(id)
}
function elevt(el, evt, fn) {
  el.addEventListener(evt, fn)
  return fn
}
function elclick(el, fn) {
  return elevt(el, 'click', fn)
}
function elhold(el, fn) {
  function _h(devt, uevt) {
    elevt(el, devt, function mdl(e) {
      e.preventDefault()
      fn()
      var t = setTimeout(function c() {
        fn()
        t = setTimeout(c, 100)
      }, 500)
      elevt(document, uevt, function mul(e) {
        e.preventDefault()
        clearTimeout(t)
        document.removeEventListener(uevt, mul)
      })
    })
  }
  // todo: detect which platform we're on?
  _h('mousedown', 'mouseup')
  _h('touchstart', 'touchend')
}
function ready(fn) {
  elevt(document, 'DOMContentLoaded', fn)
}

// support for high-resolution screens
function setupcanvas(cvs) {
  ctx = cvs.getContext('2d')
  var ratio = window.devicePixelRatio || 1
  if (ratio !== 1) {
    var oW = cvs.width
    var oH = cvs.height
    cvs.width = ratio * oW
    cvs.height = ratio * oH
    cvs.style.width = oW + 'px'
    cvs.style.height = oH + 'px'
    ctx.scale(ratio, ratio)
  }
}

function dotanimation(time, dur, fn) {
  return function tick(t) {
    var dt = t - time
    if (dt >= dur) {
      return true // how do we indicate we're done?
    }
    fn(dt, dur)

    return false
  }
}
// draw the visualization
var animations = []
var lastBeat = -1
function updatecanvas(running, beat, t) {
  var cvs = elid('dotcanvas')
  ctx = cvs.getContext('2d')
  ctx.clearRect(0, 0, cvs.clientWidth, cvs.clientHeight)
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = '#536878'
  ctx.fillRect(0, 0, cvs.clientWidth, cvs.clientHeight)
  for (var i = 0; i < 4; i++) {
    ctx.save()
    ctx.strokeStyle = '#536878'
    ctx.translate(i * cvs.clientWidth / 4, 0)
    ctx.beginPath()
    ctx.arc(25, 25, 10, 0, 2 * Math.PI)
    ctx.closePath()
    ctx.stroke()
    ctx.restore()
  }
  if (running && lastBeat != beat) {
    animations.push(
      dotanimation(t, 0.25, function(dt, dur) {
        var offs = beat % 4
        ctx.save()
        ctx.translate(offs * ctx.canvas.clientWidth / 4, 0)
        ctx.fillStyle = 'rgba(83,104,120,' + (1.0 - dt / dur) + ')'
        ctx.beginPath()
        ctx.arc(25, 25, 10, 0, 2 * Math.PI)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      })
    )
    lastBeat = beat
  }
  var finished = []
  animations.forEach(function(a, idx) {
    if (a(t)) {
      finished.push(idx)
    }
  })
  animations = animations.filter(function(_, idx) {
    return !finished.includes(idx)
  })
}
ready(function() {
  var AudioContext = window.AudioContext || window.webkitAudioContext
  var ctx = new AudioContext()
  var gain = ctx.createGain()
  var beat = -1
  var tempo = 120
  var nextNoteTime = 0.0
  var lookahead = 0.1
  var running = false

  gain.connect(ctx.destination)

  setupcanvas(elid('dotcanvas'))
  updatecanvas(false, 0, 0)

  var tempoDisplay = elid('tempo-disp')
  tempoDisplay.innerText = tempo

  var tempoIncBtn = elid('tempo-inc')
  elhold(tempoIncBtn, function(evt) {
    tempo += 1.0
    tempoDisplay.innerText = tempo
  })
  tempoDecBtn = elid('tempo-dec')
  elhold(tempoDecBtn, function(evt) {
    tempo -= 1.0
    tempoDisplay.innerText = tempo
  })
  startBtn = elid('start')
  elclick(startBtn, function(evt) {
    var iconStop = elid('icn-stp')
    var iconStart = elid('icn-sta')
    if (running) {
      running = false
      iconStop.style.display = 'none'
      iconStart.style.display = 'block'
    } else {
      // Important! On mobile browsers, you can only
      // resume (start) the audio context in response
      // to a user-initiated event like a button click
      ctx.resume()
      running = true
      nextNoteTime = ctx.currentTime
      beat = -1
      iconStart.style.display = 'none'
      iconStop.style.display = 'block'
    }
  })
  /**
   * @param AudioContext ctx - The AudioContext
   * @param AudioNode dest - The destination node
   * @param float time - When should the beep happen in `ctx`s timeline?
   * @param boolean high - Is this a 'high' (beginning of bar) beep?
   */
  function beep(ctx, dest, time, high) {
    var osc = ctx.createOscillator()
    var gain = ctx.createGain()

    var endT = time + 60.0 / tempo / 2.0

    osc.connect(gain)
    // use the gain node as an envelope to give us a little
    // 30 millisecond attack and then fade out to silence to avoid
    // a discontinuity at the end of the note
    gain.gain.setValueAtTime(1.0, time)
    gain.gain.linearRampToValueAtTime(0.6, time + 0.03)
    gain.gain.linearRampToValueAtTime(0.0001, endT)
    gain.connect(dest)
    osc.frequency.setValueAtTime(high ? 880.0 : 440.0, time)
    osc.start(time)
    osc.stop(endT)
  }
  setInterval(function() {
    // we use a lookahead scheme to schedule the metronome's beats
    // see https://www.html5rocks.com/en/tutorials/audio/scheduling/
    // for an in-depth explanation.
    //
    // Note we do this in a while loop to handle the case where multiple
    // notes need to be scheduled in the lookahead window, e.g.,
    // at very high tempos
    var cTime = ctx.currentTime
    while (running && nextNoteTime < cTime + lookahead) {
      beat++
      beep(ctx, gain, nextNoteTime, beat % 4 === 0)
      nextNoteTime = nextNoteTime + 60.0 / tempo
    }
  }, 25)

  function update(dt) {
    updatecanvas(running, beat, ctx.currentTime)
    window.requestAnimationFrame(update)
  }
  update()
})
