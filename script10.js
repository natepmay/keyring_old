// 10 is the version where I use custom SVGs for dots. Haven't finished the lockdown feature yet.
// **make it be able to go counterclockwise (probably create segarrays or maybe a function that can populate them)
// **update upon arrival
// to do:
// - lock down feature
// - design/css
// - hold mouse down
// - secondary lines

// ||||| DEFINITIONS |||||

const blackKeys = [0,1,0,1,0,0,1,0,1,0,1,0];
const whiteKeyNames = {0:"C",2:"D",4:"E",5:"F",7:"G",9:"A",11:"B"};
const svgNS = 'http://www.w3.org/2000/svg';
let genId = 0;

const segParams = {
  innerR: 100,
  outerR: 200,
}

segParams.midR = (segParams.innerR+segParams.outerR)/2;

const save = {
  proj: {
    numSegments: 12,
    numLayers: 4,
    baseRotation: 0,
    includeSecondary: false,
  },
  layers: [
    {
      isVisible: true,
    },
    {
      notes: {}, // in the form {id: note}
      segArray: [], // straight up segment numbers
      hilitNote: null,
      isVisible: true,
    },
  ],
}

for(let a=0;a<(save.proj.numLayers-2);a++){
  save.layers.push({
    notes: {},
    hilitNote: null,
    isVisible: true,
  })
}

const temp = {
  proj: {
    activeLayer: 1,
    isHiliting: false,
    isBusy: false,
    playbackMode: "chord",
  },
  layers: [
    {},
    {
      lockToPath: false,
      isChecked: false,
      intervals: {},
    },
  ],
  computed: {
    positionPoints: [], // these have x, y, and ang
  }
}

for(let a=0;a<(save.proj.numLayers-2);a++){
  temp.layers.push({
    lockToPath: false,
    isChecked: false,
    notes: [], // depracate?
    intervals: {},
  })
}

const svg = document.getElementById("keyringSVG");

// ||||| CLASSES |||||

class Note {
  constructor(layer, segment){
    this.hilite = null;
    this.layer = layer;
    this.segment = segment;
    this.id = makeId();
    this.x = temp.computed.positionPoints[this.segment].x;
    this.y = temp.computed.positionPoints[this.segment].y;
    this.primarySegment = undefined; // **this only goes one wayyy
    this.secondarySegments = [];
    let noteElem = document.createElementNS(svgNS, "use");
    setAttributes(noteElem, {
      "href": `#dot${this.layer}`,
      "width": "40px",
      "viewbox": "-128 -128 256 256",
      "transform": `translate (${this.x}, ${this.y})`,
      "class": "notelayer"+layer.toString(),
      "id": "note"+this.id.toString(),
    });
    let lyrGrp = document.getElementById(`noteGroupLayer${this.layer}`);
    lyrGrp.appendChild(noteElem);
  }
  remover(){
    let toRemove = document.getElementById("note"+this.id.toString());
    toRemove.remove();
  }
  refresher(ex,wy){
    let thisNote = document.querySelector(`#note${this.id}`);
    thisNote.setAttributeNS(null, "transform", `translate (${ex}, ${wy})`);
    this.x = ex;
    this.y = wy;
  }
}

class Hilite {
  constructor(note){
    this.note = note;
    this.id = makeId();
    note.hilite = this;
    let hiliteElem = document.createElementNS(svgNS, "circle");
    const ang = temp.computed.positionPoints[note.segment].ang;
    const coords = getCoords((segParams.innerR+segParams.outerR)/1.333,ang);
    console.log(`coords: ${coords.x} ${coords.y}`);
    setAttributes(hiliteElem, {
      "transform": `translate${coords.x},${coords.y}`,
      "r": 10,
      "class": "hilite",
      "id": "hilite"+this.id,
    })
    svg.appendChild(hiliteElem);
    console.log("made hilite");
  }
  remover(){
    this.note.hilite = undefined;
    let toRemove = document.getElementById("hilite"+this.id.toString());
    toRemove.remove();
  }
}
class Interval {
  constructor(layer, origId, destId, isPrimary){
    const origNote = save.layers[layer].notes[origId];
    const destNote =  save.layers[layer].notes[destId];
    const posPts = temp.computed.positionPoints;
    const twoPts = [posPts[origNote.segment], posPts[destNote.segment]];
    const ic = calcIc(origNote.segment,destNote.segment);
    isPrimary && (origNote.primaryInterval = this);
    isPrimary || origNote.secondaryInterals.push(this);
    this.isPrimary = isPrimary; // boolean
    this.layer = layer;
    this.ic = ic;
    this.id = makeId();
    this.origId = origId;
    this.destId = destId;
    this.origLoc = twoPts[0]; // do I still need these?
    this.destLoc = twoPts[1];
    this.path = `M ${twoPts[0].x} ${twoPts[0].y} L ${twoPts[1].x} ${twoPts[1].y}`;
    // draw it!
    let intervalElem = document.createElementNS(svgNS, "path");
    setAttributes(intervalElem,{
      "d": this.path,
      "class": `interval ic${this.ic}`,
      "id": `interval${this.id}`,
    })
    this.intervalElem = intervalElem;
    let intLyrGrp = document.getElementById(`intervalGroupLayer${this.layer}`);
    intLyrGrp.appendChild(intervalElem);
  }
  remover(){
    let toRemove = document.getElementById("interval"+this.id.toString());
    toRemove.remove();
  }
  refresher(){
    const origNote = save.layers[this.layer].notes[this.origId];
    const destNote = save.layers[this.layer].notes[this.destId];
    const thisInterval = document.querySelector(`#interval${this.id}`);
    const newPath = `M ${origNote.x} ${origNote.y} L ${destNote.x} ${destNote.y}`;
    this.path = newPath;
    thisInterval.setAttributeNS(null,"d",newPath);
    this.intervalElem.setAttributeNS(null,"d",newPath); // really need both of these?
  }
}


// ||||| FUNCTIONS |||||

function toggleNote(i){
  if(!temp.proj.isHiliting){
    let al = temp.proj.activeLayer;
    let notes = save.layers[al].notes;
    for(let [id,note] of Object.entries(notes)){
      if(note.segment === i){
        // remove
        removeNote(note);
        makeIntervals(al);
        return;
      }
    }
    // if not removing, create!
    makeNote(al,i)
    makeIntervals(al);
    return;
  }
  // if hiliting:
  toggleHilite(i);
}

function makeNote(layer,segment){
  newNote = new Note(layer,segment);
  save.layers[layer].notes[newNote.id] = newNote;
}

function makeHilite(chosenNote){
  let layer = chosenNote.layer;
  save.layers[layer].hilitNote && removeHilite(save.layers[layer].hilitNote);
  new Hilite(chosenNote);
  save.layers[layer].hilitNote = chosenNote
}

function removeHilite(chosenNote){
  // should this take the hilite instead of the note?
  let layer = chosenNote.layer;
  chosenNote.hilite.remover();
  save.layers[layer].hilitNote = undefined;
}

function setAttributes(elem,obj){
  for(let p in obj){
    elem.setAttributeNS(null,p,obj[p]);
  }
}

function makeKeyring() {
  let baseGroup = document.createElementNS(svgNS, "g");
  setAttributes(baseGroup,{id: "baseGroup"});
  svg.appendChild(baseGroup);
  let intLayers = [];
  let noteLayers = [];
  for(let a=1;a<save.proj.numLayers;a++){
    let curInt = document.createElementNS(svgNS, "g");
    setAttributes(curInt,{id: `intervalGroupLayer${a}`});
    intLayers.push(curInt);
    let curNote = document.createElementNS(svgNS, "g");
    setAttributes(curNote,{id: `noteGroupLayer${a}`});
    noteLayers.push(curNote);
  }
  for(let a of [intLayers,noteLayers]){
    for(let b=0;b<save.proj.numLayers-1;b++){
      svg.appendChild(a[b]);
    }
  }
  let textGroup = document.createElementNS(svgNS, "g"); // text group for the note names
  setAttributes(textGroup,{id: "textGroup"});
  svg.appendChild(textGroup);
  let clickGroup = document.createElementNS(svgNS, "g"); // this is the one for the invisible clickable segments
  setAttributes(clickGroup,{id: "clickGroup"});
  svg.appendChild(clickGroup);
  let midR = (segParams.outerR+segParams.innerR)/2;
  let segmentAngDeg = 360/save.proj.numSegments;
  let segmentAng = (Math.PI*2)/save.proj.numSegments;
  let seg = [{x: segParams.innerR, y: 0}, getCoords(segParams.innerR,segmentAng), getCoords(segParams.outerR,segmentAng), {x: segParams.outerR, y: 0}];
  for(let i=0;i<save.proj.numSegments;i++){
    let segmentPath = document.createElementNS(svgNS, "path");
    let edgeRotate = (segmentAngDeg*i)-90; // the rotation of the first edge of the segment in degrees
    let midRotate = (segmentAng*i)-((Math.PI/2)-(segmentAng/2)); // rotation of the middle of the segment (for dot positions) in radians
    // console.log(`edge: ${edgeRotate} mid:${midRotate}`);
    let segAttr = {
      "d": `M ${seg[0].x} ${seg[0].y} A ${segParams.innerR} ${segParams.innerR} 0 0 1 ${seg[1].x} ${seg[1].y} L ${seg[2].x} ${seg[2].y} A ${segParams.outerR} ${segParams.outerR} 0 0 0 ${seg[3].x} ${seg[3].y} Z`,
      "transform": `rotate(${edgeRotate})`,
      "class": ["whiteKey","blackKey"][blackKeys[i]]
    }
    setAttributes (segmentPath, segAttr);
    baseGroup.appendChild(segmentPath);
    let segmentPathInvis = document.createElementNS(svgNS, "path");
    setAttributes(segmentPathInvis,segAttr);
    setAttributes(segmentPathInvis,{
      class: "invisiKey",
      "onclick": `toggleNote(${i})`,
    });
    clickGroup.appendChild(segmentPathInvis);
    let obj = getCoords(midR,midRotate);
    obj.ang = midRotate;
    temp.computed.positionPoints.push(obj); // fill in the positionPoints
    // if i is in the object.Keys of whiteKeyNames, add a text and transform it/rotate it into place using midrotate
    if(Object.keys(whiteKeyNames).includes(i.toString())){
      console.log(`includes ${i}`);
      const textRad = 180;
      let textEl = document.createElementNS(svgNS,"text");
      let noteNameNode = document.createTextNode(whiteKeyNames[i]);

      let textCoords = getCoords(textRad,midRotate);
      console.log(`textCoords: ${textCoords.x} ${textCoords.y}`);
      setAttributes(textEl,{
        "transform": `translate(${textCoords.x},${textCoords.y}) rotate(${edgeRotate+((360/save.proj.numSegments)/2)+90})`,
      })
      textEl.appendChild(noteNameNode);
      textGroup.appendChild(textEl);
    }
  }
}

function updateActiveLayer(layer){
  if(!temp.proj.isBusy) {
    temp.proj.activeLayer = layer;
    console.log(`active layer: ${temp.proj.activeLayer}`);
    updateLayerCheck(layer,"checked");
    // update UI
    for(let a=0;a<save.proj.numLayers;a++){
      let curLayerElems = document.querySelectorAll(`.layer${a}`);
      curLayerElems.forEach(curLayerElem => {
        let elemClass = curLayerElem.getAttribute("class");
        let elemClassNew = (a == layer) ? elemClass.replace("inert","active") : elemClass.replace("active","inert");
        curLayerElem.setAttribute("class",elemClassNew);
      })
    }
  }
}

function makeId(){
  genId++;
  return genId;
}

function getCoords(rad,ang){
  let ex = rad*Math.cos(ang);
  let wy = rad*Math.sin(ang);
  return({x: ex, y: wy});
}

function updateVisible(){
  let newState = !save.layers[temp.proj.activeLayer].isVisible;
  save.layers[temp.proj.activeLayer].isVisible = newState;
  // update the icon:
  const shownIcon = document.getElementById(`context-shown`);
  shownIcon.setAttributeNS(null,"display",newState ? "inline" : "none");
  const hiddenIcon = document.getElementById(`context-hidden`);
  hiddenIcon.setAttributeNS(null,"display",newState ? "none" : "inline");
  if(temp.proj.activeLayer !== 0){
    const layerIntervals =  document.getElementById(`intervalGroupLayer${temp.proj.activeLayer}`);
    layerIntervals.setAttributeNS(null,"display",newState ? "inline" : "none");
    const layerNotes = document.getElementById(`noteGroupLayer${temp.proj.activeLayer}`);
    layerNotes.setAttributeNS(null,"display",newState ? "inline" : "none");
  } else {
    const baseG =  document.getElementById(`baseGroup`);
    baseG.setAttributeNS(null,"display",newState ? "inline" : "none");
    const textG =  document.getElementById(`textGroup`);
    textG.setAttributeNS(null,"display",newState ? "inline" : "none");
  }
  // **also add the hilite group in here!
  // ** could maybe make a helper function cause you're doing the same thing over and over
}

function rotate(dir){
  let segAng = (Math.PI*2)/save.proj.numSegments;
  function getArc(seg) { // this figures out the arc of one segment rotation in the correct direction
    let firstSeg = -Math.PI/2;
    let firstAng = (segAng*0.5)+(segAng*seg)+firstSeg;
    let secondAng = (dir===1) ? (segAng*1.5)+(segAng*seg)+firstSeg : (segAng*0.5)+(segAng*(seg-1))+firstSeg;
    let flag = (dir===1) ? 1 : 0;
    // console.log(`firstAng: ${firstAng} secondAng: ${secondAng}`);
    let r = segParams.midR; // use a different r for the hilite note. and potentially a different angle if it's off center
    const oneKeyArc = {
      y1: r*Math.sin(firstAng),
      x1: r*Math.cos(firstAng),
      y2: r*Math.sin(secondAng),
      x2: r*Math.cos(secondAng),
    }
    let arcPath = document.createElementNS(svgNS,"path");
    setAttributes(arcPath,{
      "d": `M ${oneKeyArc.x1} ${oneKeyArc.y1} A ${segParams.midR} ${segParams.midR} 0 0 ${flag} ${oneKeyArc.x2} ${oneKeyArc.y2}`,
    })
    return arcPath;
  }
  // noteArcs is an object that maps the ids of the notes onto the paths that they'll follow.
  // note on locked down layers: what if the target is moving?
  // okay thought about it and it should work if you're updating the invisible path (line) as you go
  // so you take the interval and copy the path and then change that path as you go
  // thoughts on how to do this:
  // - change the loops below so they work whether it's locked or not.
  // x add refresher(ex,wy) functions in the Note class and refresher() in the Interval class?
  // x create x and y attributes for Notes and update them as you go
  // x put an attribute in the note class for the primary interval that comes out of it, and set this when creating an interval
  // 1. grab the path of the note in question and assign it to an id in noteArc (can do this in getArc function I believe)
  // 2. let the existing code do what it do to move the note along the track and update the intervals
  // 3. during update, update noteArcs in the layer that you're locked down to, if that layer is checked. Should be able to do that by making a version of getArc that's for line segments, and grabbing the x and y attribute from the origNote and destNote.
  let noteArcs = {}; // ** noteArcs should be an object of objects where the first id is the layer
  save.layers.forEach((layer,index) => {
    console.log(layer);
    if(index !== 0 && temp.layers[index].isChecked){
      noteArcs[index] = {};
      // ** clean up: combine the big if/else into one for loop with two possibilities within depending on if locked or not.
      if(temp.layers[index].lockToPath){
        // ** side note: gonna have to make it so that the lockToPath button is grayed out if there are notes on one layer that aren't on the layer below it
        for(let note in layer.notes){
          // pull the path of the note with the same segment in the layer below
          noteArcs[index][layer.notes[note].id] = getNoteBySegment(layer.notes[note].segment,index-1).primaryInterval.intervalElem;
        }
      } else {
        for(let note in layer.notes){
          noteArcs[index][layer.notes[note].id] = getArc(layer.notes[note].segment);
        }
      }
    }
  })

  // move note
  let distance, trackLength;
  let dur = 500; //duration of one go of track, in ms
  let t = 0;
  let start;
  function update(time) {
    if(start === undefined){start = time};
    const elapsed = time - start;
    t = elapsed/dur; // portion of time completed.
    // **think about all these lets down there. should they be consts? should I instantiate them earlier?
    for(let lyrIndex of Object.keys(noteArcs)){
      for(let id of Object.keys(noteArcs[lyrIndex])){
        let track = noteArcs[lyrIndex][id];
        trackLength = track.getTotalLength();
        let targetNote = save.layers[lyrIndex].notes[id];
        distance = trackLength * t;
        let point = track.getPointAtLength(distance);
        targetNote.primaryInterval.refresher(); // not sure if this matters, but putting this first
        targetNote.refresher(Math.min(point.x),Math.min(point.y));
      }
    }
    // now go through and if a layer is checked and the one above it is locked down, update noteArcs for it
    for(let a = 1;a<save.proj.numLayers-1;a++){
      if(temp.layers[a].isChecked && temp.layers[a+1].lockToPath){
        for(let note in save.layers[a].notes){
          noteArcs[a][note.id] = note.primaryInterval.intervalElem;
        }
      }
    }
    // gret now rotate the 0th layer if checked.
    if(temp.layers[0].isChecked){
      // figure out total number of degrees in one rotation (30 for 12 segments)
      // multiply this by t to get number of degrees to to add or subtract from the saved segment rotation
      let trackLength = 360/save.proj.numSegments;
      let distance = trackLength * t;
      let origDegs = save.proj.baseRotation * (360/save.proj.numSegments);
      let target = document.getElementById("baseGroup"); // question: you're rotating only the baseGroup and not the clickGroup. Why does it still work?
      target.setAttributeNS(null,"transform",`rotate(${origDegs+(dir*distance)})`); // finish this from object
      let target2 = document.getElementById("textGroup");
      target2.setAttributeNS(null,"transform",`rotate(${origDegs+(dir*distance)})`);
    }
    if(elapsed < dur){requestAnimationFrame(update)} else arrived();
  }
  requestAnimationFrame(update);
  // now we're done rotating!
  function arrived(){
    temp.layers.forEach((layer,index) => {
      let layerNotes = save.layers[index].notes;
      // make an array with the new segments
      if(index !== 0 && layer.isChecked){
        for (let note in layerNotes){
          makeNote(index,(layerNotes[note].segment + dir + save.proj.numSegments) % save.proj.numSegments);
          // need an array of segments so if you're locked you can just add or subtract one mod the number of them
          removeNote(layerNotes[note]);
        }
        makeIntervals(index);
      }
    })
    if(temp.layers[0].isChecked){
      save.proj.baseRotation = (save.proj.baseRotation + dir + save.proj.numSegments) % save.proj.numSegments;
      let target = document.getElementById("baseGroup");
      let newDegs = save.proj.baseRotation * (360/save.proj.numSegments);
      target.setAttributeNS(null,"transform",`rotate(${newDegs})`);
    }
  }
}

function removeNote(note){
  let notes = save.layers[note.layer].notes;
  note.remover();
  delete notes[note.id];
}

function clearIt(){ // I guess clear() was taken
  if(!temp.proj.isBusy){
    save.layers.forEach((layer,index) => { // would be simpler if save and temp were merged
      if(temp.layers[index].isChecked && index !== 0){
        layer.hilitNote && removeHilite(layer.hilitNote);
        for(note of Object.values(layer.notes)){
          removeNote(note)
        };
        makeIntervals(index);
      }
    })
  }
}

function checkUncheckAll(){
  let numLayers = temp.layers.length;
  let sum = 0;
  for(let a of temp.layers){
    a.isChecked && sum++;
  }
  // idea being if they're not all checked then check them all, otherwise uncheck them all
  const batchAction = (sum < numLayers) ? "checked" : "unchecked";
  for(let a=0;a<numLayers;a++){updateLayerCheck(a,batchAction)};
}

function updateLayerCheck(layer,state){ // state can be "checked", "unchecked", or "toggle"
  let isLayerChecked = temp.layers[layer].isChecked;
  isLayerChecked = {"checked": true, "unchecked": false, "toggle": !isLayerChecked}[state];
  console.log(`layer: ${layer} state: ${isLayerChecked}`);
  temp.layers[layer].isChecked = isLayerChecked;
  // update UI
  const checkedBox = document.getElementById(`layer${layer}-checked`);
  checkedBox.setAttributeNS(null,"display",isLayerChecked ? "inline" : "none");
  const uncheckedBox = document.getElementById(`layer${layer}-unchecked`);
  uncheckedBox.setAttributeNS(null,"display",isLayerChecked ? "none" : "inline");
}

function makeIntervals(layer){
  // called from note constructor. also call when you've landed after a lockDown animation. and when generating from a query string
  // delete all the current intervals
  if(layer !== 0){
    let intervals = temp.layers[layer].intervals;
    for(let [id,interval] of Object.entries(intervals)){
      intervals[id].remover();
      delete intervals[id];
    }
    // make primary intervals
    if(!save.proj.includeSecondary){ // **maybe take this out of the if. will need to make these either way, right?
      let notes = save.layers[layer].notes;
      let sortedNotes = Object.values(notes).sort((a,b) => a.segment > b.segment ? 1 : -1);
      for(let a=0;a<sortedNotes.length;a++){
        newInterval = new Interval(layer,sortedNotes[a].id,sortedNotes[(a+1)%sortedNotes.length].id,true);
        temp.layers[layer].intervals[newInterval.id] = newInterval;
      }
    }
  }
  // **to do: make the secondary intervals if that's chosen
}

function makeNotes(layer, segArray){
  let returnArray = [];
  for(let seg of segArray){
    let newNote = makeNote(layer,seg);
    returnArray.push(newNote);
  }
  return returnArray;
  // called when using mergeDown or copyUp or when generating from a query string
  // reads the segements from an array and makes the notes and returns an array of them
}

function calcIc(origPos,destPos){
  const segs = save.proj.numSegments;
  const wayOne = (origPos-destPos+segs)%segs;
  const wayTwo = (destPos-origPos+segs)%segs;
  return (wayOne < wayTwo) ? wayOne : wayTwo;
}

function copyUp(){
  // make sure to disable this for layers 0 and 3
  let al = temp.proj.activeLayer;
  let segArray = [];
  let notes = save.layers[al].notes;
  for(let id in notes){
    segArray.push(notes[id].segment);
  }
  let hilitNote = save.layers[al].hilitNote;
  makeNotes(al+1,segArray);
  makeIntervals(al);
  makeIntervals(al+1);
  if(hilitNote){
    let noteToAddHiliteTo = getNoteBySegment(hilitNote.segment,al+1);
    makeHilite(noteToAddHiliteTo);
  }
}

function mergeDown(){
  // make sure to disable this for layers 0 and 1
  let al = temp.proj.activeLayer;
  let segArray = [];
  let notes = save.layers[al].notes;
  save.layers[al].hilitNote && removeHilite(save.layer[al].hilitNote);
  for(let id in notes){
    segArray.push(notes[id].segment);
    removeNote(notes[id]);
  }
  let notesArray = makeNotes(al-1,segArray);
  makeIntervals(al);
  makeIntervals(al-1);
}

function toggleHiliteMode(){
  temp.proj.isHiliting = !temp.proj.isHiliting;
  console.log(`hiliting: ${temp.proj.isHiliting}`)
}

function toggleHilite(i){
  const al = temp.proj.activeLayer;
  chosenNote = getNoteBySegment(i,al);
  console.log(`chosenNote: ${chosenNote}`);
  if(chosenNote && chosenNote.hilite != null){
    removeHilite(chosenNote);
  }
  else if(chosenNote && chosenNote.hilite == null){
    makeHilite(chosenNote);
  };
  toggleHiliteMode();
}

function getNoteBySegment(seg,layer){
  let toReturn = undefined;
  Object.values(save.layers[layer].notes).forEach((note,index) => {
    if(note.segment === seg){
      toReturn = note;
    }
  })
  return toReturn;
}

function getKeyByValue(object, value) {
  return Object.keys(object).find(key => object[key] === value);
}

function toggleLockToPath(){
  // ** gray this out/disable it if there are notes on the active layer that aren't on the layer below it
  // ** can do this by creating a new class that doesn't have an onclick
  temp.layers[temp.proj.activeLayer].lockToPath = !temp.layers[temp.proj.activeLayer].lockToPath;
  console.log(`layer is locked to path? ${temp.layers[temp.proj.activeLayer].lockToPath}`);
}


makeKeyring()

/*
Stuff in the keyring SVG:
- group for base layer
- groups for intervals on each layer
- groups for notes on each layer
- invisible segment group


*/



/*
Objects:
save - contains all the data that gets included in the query string (but in a more useful form)
  + proj
    - numSegments - number of possible positions on the circle (usually 12 but why limit)
    - baseRotation - rotation of first (keyboard layer).
    - includeSecondary - secondary lines (boolean)
    - numLayers - number of layers
  + layers - array, with each item containing the following:
    - notes - array of positions of notes on each layer
    - hilitNote - position (or index in notes array?) of hilit note, or null
    - isVisible - boolean

temp - has same format but only for temporary things
  + proj
    - activeLayer - index of active layer
    - layersChecked - array of booleans for whether layers are checked
    - isHiliting - boolean for hilite mode
    - isAnimating - boolean for if it's working. freeze interface if it is.
    - playbackMode - chord or arp
  + layers - array, with each item containing the following:
    - lockToPath - boolean
    - notes - an array with
      + noteIDs - ID of the elements of each of the notes
      + pathIDs - array of IDs of the paths for the intervals
  + computed
    - positionPoints - array of {x: y:} objects with positions for each point on the circle

Functions:
updateLayersChecked(layer #) - called when a box is checked. updates the array.
updateActiveLayer(layer #) - called when layer is clicked and !isAnimating.
  updates the array.
  changes classes of elements to update UI.
  checks that layer?
updateVisible() - called when visibility icon is clicked and !isAnimating. toggles a Boolean for active layer. updates class of element.
toggleNote(segment #) - called when you click a key and !isAnimating.
  if hilite mode is on, call toggleHilite(). else,
    if there's not a note,
      adds a note to the array for the active layer.
      creates a group and an element for that note (new Note). group will include hilite if it's hilited.
      adds the ID (these IDs just increment forever) to temp.layers.noteIDs. (should some of this go in a class constructor? yes).
      updates the intervals (or maybe calls a function to do so)
    if there is a note, it removes it associated arrays and removes element.
toggleHilite() - called from toggleNote() when hilite mode is on. updates isHiliting. creates or removes hilite element and updates save.layers.hilitNote.
rotate(-1 for counterclockwise/1 for clockwise) - called when a rotate button is clicked.
  update the position arrays for the notes.
  update isAnimating.
  animate the rotation (Note.move()):
    if it's locked to the layer below, create a path directly from one note to the next
    if not, create an arc path to the next key (someday figure out how to hold the click down to keep rotating)
    send everything on its way
clear() - called when clear is clicked and !isAnimating. Clear the array for that layer and remove the elements in it.
checkUncheckAll() - called when checkAll element is toggled.
  if any layers are unchecked, turn all the layersChecked to checked
  if all layers are checked, turn them all to false
updateLayerCheck(layer) - called when you hit a check box or if you  a layer active or toggleCheckAll()
  updates the array
  switches the SVG
copyUp() - called when copy up button is pressed and !isAnimating
  add all notes and hilit note to the layer above
mergeDown() - called when merge down button is pressed and !isAnimating
  delete all notes from active layer and add them to the layer below
  hilit note gets forgotten
undo() - need to add this later. use an undo manager?
toggleHiliteMode() - called when hilite button is pressed
  turns hiliteMode on or off
  updates class of hilite button element
updatePlaybackMode(mode) - called when radio button for playback mode is selected
  updates playbackMode

togglePlayback() - called when play button is pressed and !isAnimating.
  plays notes in the selected layers according to the playbackMode. ooh maybe it pans different layers differently? or dif timbres?
  called when stop button is pressed. stops any sound with a fade.

Classes:
Note:
  constructor(layer,segment,id)
  move(dir, lockToPath) - moves the visible note (take care of array stuff in function)
  remove() - pulls it off the document
  toggleHilite()
Interval (should this belong to the note instance? no)
Hilite (this should belong to the note instance?)



*/
