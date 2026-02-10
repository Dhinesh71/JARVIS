
const { playMusicOnYoutube } = require('./utils/mediaAgent');

async function test() {
    console.log("Testing Music Playback...");
    await playMusicOnYoutube("thalaphy kacheri song");
}

test();
