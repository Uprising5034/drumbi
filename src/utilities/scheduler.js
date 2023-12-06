import { getAudioCtx } from "./audioContext";

import kickPath from "@assets/audio/kick.wav";
import snarePath from "@assets/audio/snare.wav";
import hiHatClosedPath from "@assets/audio/hiHatClosed.wav";

let audioCtx; // context must be generated after user action
let bufferLoading = false;
let bufferLoaded = false;

const audioBuffer = {
  kick: {
    path: kickPath,
  },
  snare: {
    path: snarePath,
  },
  hiHatClosed: {
    path: hiHatClosedPath,
  },
};

const lookahead = 0.1;

let startTime = null;

let nextBeatTime = null;

const bpm = 120;
const beatCount = 4;
const sequencerTimeLength = (60 / bpm) * beatCount;

const sequencerQueue = [
  {
    time: 0,
    subBeats: [["hiHatClosed", "kick"]],
  },
  {
    time: (sequencerTimeLength / 4) * 1,
    subBeats: [["hiHatClosed"]],
  },
  {
    time: (sequencerTimeLength / 4) * 2,
    subBeats: [["hiHatClosed", "snare"], [], ["kick"], ["snare"]],
  },
  {
    time: (sequencerTimeLength / 4) * 3,
    subBeats: [["hiHatClosed"], [], ["snare"], ["kick"], ["kick"]],
  },
];
let sequencerQueueIndex = 0;

async function loadBuffer() {
  if (!bufferLoaded && !bufferLoading) {
    bufferLoading = true;
    const promises = [];
    for (const key in audioBuffer) {
      promises.push(fetchAudioFiles(key));
    }
    await Promise.all(promises);
    bufferLoaded = true;
  }
}

async function fetchAudioFiles(key) {
  const track = audioBuffer[key];
  if (!track.buffer) {
    const response = await fetch(track.path);
    const audioData = await response.arrayBuffer();
    return (track.buffer = await audioCtx.decodeAudioData(audioData));
  }
}

function scheduler() {
  audioCtx = getAudioCtx();
  loadBuffer();

  if (!bufferLoaded) return;

  setStartTime();

  while (nextBeatTime < audioCtx.currentTime + lookahead) {
    const nextBeat = sequencerQueue[sequencerQueueIndex];
    const subBeatLength =
      sequencerTimeLength / beatCount / nextBeat.subBeats.length;

    nextBeat.subBeats.forEach((subBeat, subBeatIdx) => {
      const subBeatTime = nextBeatTime + subBeatLength * subBeatIdx;
      subBeat.forEach((note) => {
        scheduleNote(subBeatTime, audioBuffer[note].buffer);
      });
    });

    setNextNote();
  }
}

async function scheduleNote(time, buffer) {
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);

  source.start(time);
}

function setNextNote() {
  const curQIdx = sequencerQueueIndex;
  const nextQIdx = (sequencerQueueIndex =
    (sequencerQueueIndex + 1) % sequencerQueue.length);

  const prevTime = sequencerQueue[curQIdx].time;
  const nextTime = sequencerQueue[nextQIdx].time;

  if (nextQIdx === 0) {
    nextBeatTime += sequencerTimeLength - prevTime;
  } else {
    nextBeatTime += nextTime - prevTime;
  }
}

function setStartTime() {
  if (!startTime) {
    nextBeatTime = startTime = audioCtx.currentTime + lookahead;
  }
}

function clearStartTime() {
  startTime = null;
}

function clearSequencer() {
  sequencerQueueIndex = 0;
}

function clearScheduler() {
  clearStartTime();
  clearSequencer();
}

export { clearScheduler, scheduler, sequencerQueueIndex };
