var path = require('path');
var pkg = require(path.resolve(__dirname, '../package.json'));
var Codetrack = require('@ali/codetrack')({
    defaultSamplingRatio: 1,
    maxSamplingRatio: 1,
    dataId: '43',
    dataToken: '17e62166fc8586dfa4d1bc0e1742c08b',
    version: pkg.version
});
var codeTrack = Codetrack.track.bind(Codetrack);

codeTrack('tap.root', null);

module.exports = codeTrack;